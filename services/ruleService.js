const {
  materialNames,
  agentRelationNames,
  businessTypeNames,
  communityNames,
  reviewLevelNames,
  getLatestRuleVersion,
  getRuleVersionByNumber,
  getAllRuleVersions
} = require('../config/rules');
const cardTypes = require('../config/cardTypes');

function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2 - d1);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

function isMaterialExpired(material, validityDays, handleDate) {
  if (!validityDays || validityDays <= 0) {
    return false;
  }
  if (!material.issueDate) {
    return false;
  }
  const daysSinceIssued = daysBetween(material.issueDate, handleDate);
  if (material.expiryDate) {
    const expiryDate = new Date(material.expiryDate);
    const handle = new Date(handleDate);
    if (handle > expiryDate) {
      return true;
    }
  }
  return daysSinceIssued > validityDays;
}

function findMaterialAlternatives(requiredKey, userMaterialKeys, alternatives) {
  if (!alternatives || !alternatives[requiredKey]) {
    return [];
  }
  return alternatives[requiredKey].filter(alt => userMaterialKeys.includes(alt));
}

function matchRule(cardType, businessType, params) {
  const {
    age,
    isPresent,
    agentRelation,
    materialKeys,
    materials,
    communityId = 'all',
    handleDate = new Date().toISOString().split('T')[0]
  } = params;

  const cardConfig = cardTypes[cardType];
  if (!cardConfig) {
    return {
      success: false,
      canProceed: false,
      errors: ['未知的卡证类型'],
      missingMaterials: [],
      expiredMaterials: [],
      alternativeSuggestions: [],
      agentAllowed: false,
      agentErrors: [],
      agentRestrictions: [],
      seniorReview: null,
      nextSteps: [],
      ruleVersion: null,
      specialReminders: []
    };
  }

  if (!cardConfig.businessTypes.includes(businessType)) {
    return {
      success: false,
      canProceed: false,
      errors: [`${cardConfig.name}不支持此业务类型`],
      missingMaterials: [],
      expiredMaterials: [],
      alternativeSuggestions: [],
      agentAllowed: false,
      agentErrors: [],
      agentRestrictions: [],
      seniorReview: null,
      nextSteps: [],
      ruleVersion: null,
      specialReminders: []
    };
  }

  const ruleVersion = getLatestRuleVersion(businessType, communityId, handleDate);
  if (!ruleVersion) {
    return {
      success: false,
      canProceed: false,
      errors: ['未找到适用的规则版本'],
      missingMaterials: [],
      expiredMaterials: [],
      alternativeSuggestions: [],
      agentAllowed: false,
      agentErrors: [],
      agentRestrictions: [],
      seniorReview: null,
      nextSteps: [],
      ruleVersion: null,
      specialReminders: []
    };
  }

  if (!ruleVersion[cardType]) {
    return {
      success: false,
      canProceed: false,
      errors: ['该卡证不支持此业务类型'],
      missingMaterials: [],
      expiredMaterials: [],
      alternativeSuggestions: [],
      agentAllowed: false,
      agentErrors: [],
      agentRestrictions: [],
      seniorReview: null,
      nextSteps: [],
      ruleVersion: null,
      specialReminders: []
    };
  }

  const rule = ruleVersion[cardType];
  const result = {
    success: true,
    canProceed: true,
    errors: [],
    missingMaterials: [],
    expiredMaterials: [],
    alternativeSuggestions: [],
    agentAllowed: false,
    agentErrors: [],
    agentRestrictions: [],
    seniorReview: null,
    nextSteps: [],
    ruleVersion: {
      version: ruleVersion.version,
      effectiveDate: ruleVersion.effectiveDate,
      applicableCommunities: ruleVersion.applicableCommunities,
      communityName: communityNames[communityId] || communityId
    },
    specialReminders: [...rule.specialReminders],
    ageCheck: {
      required: rule.ageRequirement,
      current: age,
      passed: age >= rule.ageRequirement
    },
    presenceRequired: rule.mustBePresent,
    isPresent
  };

  if (age < rule.ageRequirement) {
    result.canProceed = false;
    result.errors.push(`年龄不符合要求，需年满${rule.ageRequirement}周岁`);
  }

  const requiredMaterials = rule.requiredMaterials || [];
  const userMaterialKeysList = materialKeys || [];
  const userMaterials = materials || [];

  for (const requiredMat of requiredMaterials) {
    const hasMaterial = userMaterialKeysList.includes(requiredMat);

    if (!hasMaterial) {
      const alternatives = findMaterialAlternatives(
        requiredMat,
        userMaterialKeysList,
        ruleVersion.materialAlternatives
      );

      if (alternatives.length > 0) {
        const altDetails = alternatives.map(alt => ({
          key: alt,
          name: materialNames[alt] || alt
        }));
        result.alternativeSuggestions.push({
          original: {
            key: requiredMat,
            name: materialNames[requiredMat] || requiredMat
          },
          alternatives: altDetails,
          used: true
        });
      } else {
        result.canProceed = false;
        result.missingMaterials.push({
          key: requiredMat,
          name: materialNames[requiredMat] || requiredMat
        });
        result.alternativeSuggestions.push({
          original: {
            key: requiredMat,
            name: materialNames[requiredMat] || requiredMat
          },
          alternatives: (ruleVersion.materialAlternatives[requiredMat] || []).map(alt => ({
            key: alt,
            name: materialNames[alt] || alt
          })),
          used: false
        });
      }
    } else {
      const materialDetail = userMaterials.find(m => m.key === requiredMat);
      if (materialDetail) {
        const validityDays = ruleVersion.materialValidityDays[requiredMat];
        if (isMaterialExpired(materialDetail, validityDays, handleDate)) {
          result.canProceed = false;
          result.expiredMaterials.push({
            key: requiredMat,
            name: materialNames[requiredMat] || requiredMat,
            issueDate: materialDetail.issueDate,
            expiryDate: materialDetail.expiryDate,
            validityDays,
            daysSinceIssued: daysBetween(materialDetail.issueDate, handleDate)
          });
          result.errors.push(`${materialNames[requiredMat] || requiredMat}已过期，请重新办理`);
        }
      }
    }
  }

  if (result.missingMaterials.length > 0) {
    const missingNames = result.missingMaterials.map(m => m.name).join('、');
    result.errors.push(`缺少必要材料：${missingNames}`);
  }

  if (isPresent) {
    result.agentAllowed = true;
  } else {
    const allowedAgents = rule.allowedAgents || [];
    if (allowedAgents.length === 0) {
      result.canProceed = false;
      result.agentAllowed = false;
      result.agentErrors.push('此业务必须本人办理，不可代办');
      result.errors.push('此业务必须本人办理，不可代办');
    } else if (!agentRelation) {
      result.canProceed = false;
      result.agentAllowed = true;
      result.agentErrors.push('请提供代办人与持卡人的关系');
      result.errors.push('请提供代办人与持卡人的关系');
    } else if (!allowedAgents.includes(agentRelation)) {
      result.canProceed = false;
      result.agentAllowed = false;
      result.agentErrors.push(`${agentRelationNames[agentRelation] || agentRelation}不符合代办要求`);
      result.errors.push(`${agentRelationNames[agentRelation] || agentRelation}不符合代办要求`);
    } else {
      result.agentAllowed = true;
      result.agentRestrictions.push({
        type: 'authorization_validity',
        days: ruleVersion.agentAuthorizationValidityDays,
        description: `代办授权书有效期为${ruleVersion.agentAuthorizationValidityDays}天`
      });

      const agentRequiredMaterials = rule.agentRequiredMaterials || [];
      for (const agentMat of agentRequiredMaterials) {
        const hasMaterial = userMaterialKeysList.includes(agentMat);
        if (!hasMaterial) {
          result.canProceed = false;
          result.missingMaterials.push({
            key: agentMat,
            name: materialNames[agentMat] || agentMat,
            isAgentMaterial: true
          });
        } else {
          const materialDetail = userMaterials.find(m => m.key === agentMat);
          if (materialDetail) {
            const validityDays = ruleVersion.materialValidityDays[agentMat];
            if (isMaterialExpired(materialDetail, validityDays, handleDate)) {
              result.canProceed = false;
              result.expiredMaterials.push({
                key: agentMat,
                name: materialNames[agentMat] || agentMat,
                issueDate: materialDetail.issueDate,
                expiryDate: materialDetail.expiryDate,
                validityDays,
                daysSinceIssued: daysBetween(materialDetail.issueDate, handleDate),
                isAgentMaterial: true
              });
              result.agentErrors.push(`${materialNames[agentMat] || agentMat}已过期`);
            }
          }
        }
      }

      if (result.missingMaterials.filter(m => m.isAgentMaterial).length > 0) {
        const missingNames = result.missingMaterials
          .filter(m => m.isAgentMaterial)
          .map(m => m.name)
          .join('、');
        result.agentErrors.push(`代办缺少材料：${missingNames}`);
      }
    }
  }

  if (!isPresent && rule.mustBePresent) {
    result.canProceed = false;
    result.errors.push('此业务必须本人到场办理');
    if (!result.agentErrors.includes('此业务必须本人办理，不可代办')) {
      result.agentErrors.push('此业务必须本人到场办理');
    }
  }

  const seniorRules = ruleVersion.seniorReviewRules;
  if (seniorRules && age >= seniorRules.ageThreshold) {
    result.seniorReview = {
      triggered: seniorRules.reviewRequired,
      ageThreshold: seniorRules.ageThreshold,
      currentAge: age,
      reviewRequired: seniorRules.reviewRequired,
      reviewIntervalDays: seniorRules.reviewIntervalDays,
      reviewerLevel: seniorRules.reviewerLevel,
      reviewerLevelName: reviewLevelNames[seniorRules.reviewerLevel] || seniorRules.reviewerLevel
    };

    if (seniorRules.reviewRequired) {
      result.specialReminders.push(
        `高龄特殊复核：该老人年满${seniorRules.ageThreshold}周岁，需由${reviewLevelNames[seniorRules.reviewerLevel] || seniorRules.reviewerLevel}进行复核`
      );
      if (seniorRules.reviewIntervalDays > 0) {
        result.specialReminders.push(
          `复核周期：每${seniorRules.reviewIntervalDays}天需复核一次`
        );
      }
    }
  }

  result.nextSteps = generateNextSteps(result);

  result.businessName = businessTypeNames[businessType] || businessType;
  result.cardName = cardConfig.name;

  return result;
}

function generateNextSteps(result) {
  const steps = [];

  if (result.canProceed) {
    steps.push('材料齐全且符合要求，可正常办理');
    if (result.seniorReview && result.seniorReview.reviewRequired) {
      steps.push(`请安排${result.seniorReview.reviewerLevelName}进行高龄复核`);
    }
    if (!result.isPresent) {
      steps.push('请确认代办授权书在有效期内');
    }
  } else {
    if (result.missingMaterials.length > 0) {
      const missingNames = result.missingMaterials.map(m => m.name).join('、');
      steps.push(`请补充缺失材料：${missingNames}`);
    }
    if (result.expiredMaterials.length > 0) {
      const expiredNames = result.expiredMaterials.map(m => m.name).join('、');
      steps.push(`请更新过期材料：${expiredNames}`);
    }
    if (result.ageCheck && !result.ageCheck.passed) {
      steps.push(`年龄未达到要求，需年满${result.ageCheck.required}周岁`);
    }
    if (result.presenceRequired && !result.isPresent) {
      steps.push('此业务需本人到场办理，请安排本人前来');
    }
    if (result.agentErrors.length > 0) {
      steps.push('请解决代办相关问题后再办理');
    }
    const alternativeAvailable = result.alternativeSuggestions.filter(a => a.alternatives.length > 0 && !a.used);
    if (alternativeAvailable.length > 0) {
      for (const alt of alternativeAvailable) {
        const altNames = alt.alternatives.map(a => a.name).join('或');
        steps.push(`如无法提供${alt.original.name}，可使用${altNames}替代`);
      }
    }
  }

  return steps;
}

function getRuleConfig(cardType, businessType, communityId = 'all', handleDate = new Date().toISOString().split('T')[0]) {
  const cardConfig = cardTypes[cardType];
  if (!cardConfig || !cardConfig.businessTypes.includes(businessType)) {
    return null;
  }

  const ruleVersion = getLatestRuleVersion(businessType, communityId, handleDate);
  if (!ruleVersion || !ruleVersion[cardType]) {
    return null;
  }

  const rule = ruleVersion[cardType];

  const alternativesWithNames = {};
  for (const [key, alts] of Object.entries(ruleVersion.materialAlternatives || {})) {
    alternativesWithNames[key] = {
      original: {
        key,
        name: materialNames[key] || key
      },
      alternatives: alts.map(alt => ({
        key: alt,
        name: materialNames[alt] || alt
      }))
    };
  }

  const validityWithNames = {};
  for (const [key, days] of Object.entries(ruleVersion.materialValidityDays || {})) {
    validityWithNames[key] = {
      key,
      name: materialNames[key] || key,
      validityDays: days
    };
  }

  return {
    businessType,
    businessName: businessTypeNames[businessType],
    cardType,
    cardName: cardTypes[cardType]?.name,
    version: ruleVersion.version,
    effectiveDate: ruleVersion.effectiveDate,
    applicableCommunities: ruleVersion.applicableCommunities,
    ageRequirement: rule.ageRequirement,
    mustBePresent: rule.mustBePresent,
    allowedAgents: (rule.allowedAgents || []).map(r => ({
      key: r,
      name: agentRelationNames[r] || r
    })),
    requiredMaterials: (rule.requiredMaterials || []).map(m => ({
      key: m,
      name: materialNames[m] || m
    })),
    agentRequiredMaterials: (rule.agentRequiredMaterials || []).map(m => ({
      key: m,
      name: materialNames[m] || m
    })),
    materialAlternatives: alternativesWithNames,
    materialValidity: validityWithNames,
    agentAuthorizationValidityDays: ruleVersion.agentAuthorizationValidityDays,
    seniorReviewRules: {
      ...ruleVersion.seniorReviewRules,
      reviewerLevelName: reviewLevelNames[ruleVersion.seniorReviewRules?.reviewerLevel] || ruleVersion.seniorReviewRules?.reviewerLevel
    },
    specialReminders: rule.specialReminders || []
  };
}

function getRuleVersions(businessType) {
  return getAllRuleVersions(businessType);
}

function getRuleConfigByVersion(cardType, businessType, versionNumber) {
  const cardConfig = cardTypes[cardType];
  if (!cardConfig || !cardConfig.businessTypes.includes(businessType)) {
    return null;
  }

  const ruleVersion = getRuleVersionByNumber(businessType, versionNumber);
  if (!ruleVersion || !ruleVersion[cardType]) {
    return null;
  }

  return getRuleConfig(cardType, businessType, 'all', ruleVersion.effectiveDate);
}

function getAllMaterialNames() {
  return materialNames;
}

function getAllAgentRelations() {
  return agentRelationNames;
}

function getAllBusinessTypes() {
  return businessTypeNames;
}

function getAllCommunities() {
  return communityNames;
}

function getAllReviewLevels() {
  return reviewLevelNames;
}

module.exports = {
  matchRule,
  getRuleConfig,
  getRuleVersions,
  getRuleConfigByVersion,
  getAllMaterialNames,
  getAllAgentRelations,
  getAllBusinessTypes,
  getAllCommunities,
  getAllReviewLevels
};
