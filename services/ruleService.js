const { rules, materialNames, agentRelationNames, businessTypeNames } = require('../config/rules');
const cardTypes = require('../config/cardTypes');

function matchRule(cardType, businessType, params) {
  const { age, isPresent, agentRelation, materials } = params;

  const cardConfig = cardTypes[cardType];
  if (!cardConfig) {
    return {
      success: false,
      canProceed: false,
      errors: ['未知的卡证类型'],
      missingMaterials: [],
      agentAllowed: false,
      agentErrors: [],
      specialReminders: []
    };
  }

  if (!cardConfig.businessTypes.includes(businessType)) {
    return {
      success: false,
      canProceed: false,
      errors: [`${cardConfig.name}不支持此业务类型`],
      missingMaterials: [],
      agentAllowed: false,
      agentErrors: [],
      specialReminders: []
    };
  }

  const businessRule = rules[businessType];
  if (!businessRule || !businessRule[cardType]) {
    return {
      success: false,
      canProceed: false,
      errors: ['该卡证不支持此业务类型'],
      missingMaterials: [],
      agentAllowed: false,
      agentErrors: [],
      specialReminders: []
    };
  }

  const rule = businessRule[cardType];
  const result = {
    success: true,
    canProceed: true,
    errors: [],
    missingMaterials: [],
    agentAllowed: false,
    agentErrors: [],
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
  const userMaterials = materials || [];
  const missingMaterials = requiredMaterials.filter(m => !userMaterials.includes(m));

  if (missingMaterials.length > 0) {
    result.canProceed = false;
    result.missingMaterials = missingMaterials.map(m => ({
      key: m,
      name: materialNames[m] || m
    }));
    result.errors.push(`缺少必要材料：${missingMaterials.map(m => materialNames[m] || m).join('、')}`);
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
      const agentRequiredMaterials = rule.agentRequiredMaterials || [];
      const missingAgentMaterials = agentRequiredMaterials.filter(m => !userMaterials.includes(m));
      if (missingAgentMaterials.length > 0) {
        result.canProceed = false;
        result.missingMaterials = [
          ...result.missingMaterials,
          ...missingAgentMaterials.map(m => ({
            key: m,
            name: materialNames[m] || m
          }))
        ];
        result.agentErrors.push(`代办缺少材料：${missingAgentMaterials.map(m => materialNames[m] || m).join('、')}`);
        result.errors.push(`代办缺少材料：${missingAgentMaterials.map(m => materialNames[m] || m).join('、')}`);
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

  result.businessName = businessTypeNames[businessType] || businessType;
  result.cardName = cardConfig.name;

  return result;
}

function getRuleConfig(cardType, businessType) {
  const cardConfig = cardTypes[cardType];
  if (!cardConfig || !cardConfig.businessTypes.includes(businessType)) {
    return null;
  }
  const businessRule = rules[businessType];
  if (!businessRule || !businessRule[cardType]) {
    return null;
  }
  const rule = businessRule[cardType];
  return {
    businessType,
    businessName: businessTypeNames[businessType],
    cardType,
    cardName: cardTypes[cardType]?.name,
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
    specialReminders: rule.specialReminders || []
  };
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

module.exports = {
  matchRule,
  getRuleConfig,
  getAllMaterialNames,
  getAllAgentRelations,
  getAllBusinessTypes
};
