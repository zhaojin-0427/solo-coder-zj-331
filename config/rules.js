const rules = {
  apply: {
    name: '办理',
    versions: [
      {
        version: 'v2.0',
        effectiveDate: '2025-01-01',
        applicableCommunities: ['all'],
        materialAlternatives: {
          household_register: ['residence_permit', 'property_certificate']
        },
        materialValidityDays: {
          id_card: 1825,
          residence_permit: 365,
          property_certificate: 1825
        },
        agentAuthorizationValidityDays: 90,
        seniorReviewRules: {
          ageThreshold: 80,
          reviewRequired: true,
          reviewIntervalDays: 180,
          reviewerLevel: 'senior_staff'
        },
        bus_card: {
          requiredMaterials: ['id_card', 'photo', 'household_register'],
          mustBePresent: true,
          allowedAgents: ['spouse', 'children', 'parent', 'sibling'],
          agentRequiredMaterials: ['agent_id_card', 'proof_of_relationship', 'agent_authorization'],
          ageRequirement: 65,
          specialReminders: [
            '需本人近期一寸免冠彩色照片1张',
            '需提供本市户籍证明或居住证明',
            '首次办理免费，补办需缴纳工本费20元'
          ]
        },
        senior_card: {
          requiredMaterials: ['id_card', 'photo', 'household_register'],
          mustBePresent: true,
          allowedAgents: ['spouse', 'children', 'parent', 'sibling'],
          agentRequiredMaterials: ['agent_id_card', 'proof_of_relationship', 'agent_authorization'],
          ageRequirement: 60,
          specialReminders: [
            '需本人近期一寸免冠彩色照片1张',
            '需提供本市户籍证明',
            '年满60周岁即可办理，按周岁计算'
          ]
        },
        medical_card: {
          requiredMaterials: ['id_card', 'photo'],
          mustBePresent: false,
          allowedAgents: ['spouse', 'children', 'parent', 'sibling', 'other'],
          agentRequiredMaterials: ['agent_id_card', 'agent_authorization'],
          ageRequirement: 0,
          specialReminders: [
            '需本人近期一寸免冠彩色照片1张',
            '就诊卡可委托他人代办',
            '办卡工本费10元'
          ]
        }
      },
      {
        version: 'v1.0',
        effectiveDate: '2020-01-01',
        applicableCommunities: ['community_001', 'community_002', 'community_003'],
        materialAlternatives: {},
        materialValidityDays: {},
        agentAuthorizationValidityDays: 180,
        seniorReviewRules: {
          ageThreshold: 85,
          reviewRequired: true,
          reviewIntervalDays: 365,
          reviewerLevel: 'regular_staff'
        },
        bus_card: {
          requiredMaterials: ['id_card', 'photo', 'household_register'],
          mustBePresent: true,
          allowedAgents: ['spouse', 'children', 'parent', 'sibling'],
          agentRequiredMaterials: ['agent_id_card', 'proof_of_relationship'],
          ageRequirement: 65,
          specialReminders: [
            '需本人近期一寸免冠彩色照片1张',
            '需提供本市户籍证明或居住证明',
            '首次办理免费，补办需缴纳工本费20元'
          ]
        },
        senior_card: {
          requiredMaterials: ['id_card', 'photo', 'household_register'],
          mustBePresent: true,
          allowedAgents: ['spouse', 'children', 'parent', 'sibling'],
          agentRequiredMaterials: ['agent_id_card', 'proof_of_relationship'],
          ageRequirement: 60,
          specialReminders: [
            '需本人近期一寸免冠彩色照片1张',
            '需提供本市户籍证明',
            '年满60周岁即可办理，按周岁计算'
          ]
        },
        medical_card: {
          requiredMaterials: ['id_card', 'photo'],
          mustBePresent: false,
          allowedAgents: ['spouse', 'children', 'parent', 'sibling', 'other'],
          agentRequiredMaterials: ['agent_id_card'],
          ageRequirement: 0,
          specialReminders: [
            '需本人近期一寸免冠彩色照片1张',
            '就诊卡可委托他人代办',
            '办卡工本费10元'
          ]
        }
      }
    ]
  },

  reissue: {
    name: '补办',
    versions: [
      {
        version: 'v2.0',
        effectiveDate: '2025-01-01',
        applicableCommunities: ['all'],
        materialAlternatives: {},
        materialValidityDays: {
          id_card: 1825
        },
        agentAuthorizationValidityDays: 90,
        seniorReviewRules: {
          ageThreshold: 80,
          reviewRequired: true,
          reviewIntervalDays: 180,
          reviewerLevel: 'senior_staff'
        },
        bus_card: {
          requiredMaterials: ['id_card', 'photo'],
          mustBePresent: false,
          allowedAgents: ['spouse', 'children', 'parent', 'sibling'],
          agentRequiredMaterials: ['agent_id_card', 'proof_of_relationship', 'agent_authorization'],
          ageRequirement: 65,
          specialReminders: [
            '需本人近期一寸免冠彩色照片1张',
            '补办需缴纳工本费20元',
            '原卡内余额将转入新卡'
          ]
        },
        senior_card: {
          requiredMaterials: ['id_card', 'photo'],
          mustBePresent: false,
          allowedAgents: ['spouse', 'children', 'parent', 'sibling'],
          agentRequiredMaterials: ['agent_id_card', 'proof_of_relationship', 'agent_authorization'],
          ageRequirement: 60,
          specialReminders: [
            '需本人近期一寸免冠彩色照片1张',
            '补办需缴纳工本费15元',
            '原卡作废，不可恢复'
          ]
        },
        medical_card: {
          requiredMaterials: ['id_card'],
          mustBePresent: false,
          allowedAgents: ['spouse', 'children', 'parent', 'sibling', 'other'],
          agentRequiredMaterials: ['agent_id_card', 'agent_authorization'],
          ageRequirement: 0,
          specialReminders: [
            '补办需缴纳工本费10元',
            '原卡内余额将转入新卡',
            '如遗忘卡号，可凭身份证查询'
          ]
        }
      }
    ]
  },

  report_loss: {
    name: '挂失',
    versions: [
      {
        version: 'v2.0',
        effectiveDate: '2025-01-01',
        applicableCommunities: ['all'],
        materialAlternatives: {},
        materialValidityDays: {
          id_card: 1825
        },
        agentAuthorizationValidityDays: 30,
        seniorReviewRules: {
          ageThreshold: 80,
          reviewRequired: false,
          reviewIntervalDays: 0,
          reviewerLevel: 'regular_staff'
        },
        bus_card: {
          requiredMaterials: ['id_card'],
          mustBePresent: false,
          allowedAgents: ['spouse', 'children', 'parent', 'sibling', 'other'],
          agentRequiredMaterials: ['agent_id_card', 'agent_authorization'],
          ageRequirement: 65,
          specialReminders: [
            '挂失后24小时内生效',
            '可电话挂失后再到窗口办理正式手续',
            '挂失后找到原卡可办理解挂'
          ]
        },
        senior_card: {
          requiredMaterials: ['id_card'],
          mustBePresent: false,
          allowedAgents: ['spouse', 'children', 'parent', 'sibling', 'other'],
          agentRequiredMaterials: ['agent_id_card', 'agent_authorization'],
          ageRequirement: 60,
          specialReminders: [
            '挂失后即时生效',
            '挂失后原卡无法使用',
            '建议挂失后尽快补办新卡'
          ]
        },
        medical_card: {
          requiredMaterials: ['id_card'],
          mustBePresent: false,
          allowedAgents: ['spouse', 'children', 'parent', 'sibling', 'other'],
          agentRequiredMaterials: ['agent_id_card', 'agent_authorization'],
          ageRequirement: 0,
          specialReminders: [
            '挂失后即时生效',
            '可通过医院官网或APP自助挂失',
            '挂失后7天内可解挂'
          ]
        }
      }
    ]
  },

  annual_review: {
    name: '年审',
    versions: [
      {
        version: 'v2.0',
        effectiveDate: '2025-01-01',
        applicableCommunities: ['all'],
        materialAlternatives: {
          bus_card: ['bus_card_receipt', 'bus_card_usage_record'],
          senior_card: ['senior_card_receipt', 'senior_card_usage_record']
        },
        materialValidityDays: {
          id_card: 1825,
          bus_card: 365,
          senior_card: 730
        },
        agentAuthorizationValidityDays: 30,
        seniorReviewRules: {
          ageThreshold: 75,
          reviewRequired: true,
          reviewIntervalDays: 90,
          reviewerLevel: 'supervisor'
        },
        bus_card: {
          requiredMaterials: ['id_card', 'bus_card'],
          mustBePresent: false,
          allowedAgents: ['spouse', 'children', 'parent', 'sibling'],
          agentRequiredMaterials: ['agent_id_card', 'agent_authorization'],
          ageRequirement: 65,
          specialReminders: [
            '每年需年审一次',
            '年审通过后卡内优惠继续有效',
            '逾期未年审将暂停优惠待遇'
          ]
        },
        senior_card: {
          requiredMaterials: ['id_card', 'senior_card'],
          mustBePresent: false,
          allowedAgents: ['spouse', 'children', 'parent', 'sibling'],
          agentRequiredMaterials: ['agent_id_card', 'agent_authorization'],
          ageRequirement: 60,
          specialReminders: [
            '每两年需年审一次',
            '需确认持卡人健在且符合条件',
            '可到社区服务中心办理'
          ]
        }
      }
    ]
  }
};

const materialNames = {
  id_card: '身份证',
  photo: '一寸免冠照片',
  household_register: '户口本/居住证明',
  residence_permit: '居住证',
  property_certificate: '房产证明',
  bus_card: '公交卡原件',
  bus_card_receipt: '公交卡办卡回执',
  bus_card_usage_record: '公交卡使用记录',
  senior_card: '老年卡原件',
  senior_card_receipt: '老年卡办卡回执',
  senior_card_usage_record: '老年卡使用记录',
  medical_card: '就诊卡原件',
  agent_id_card: '代办人身份证',
  proof_of_relationship: '关系证明（户口本/结婚证等）',
  agent_authorization: '代办授权书'
};

const agentRelationNames = {
  spouse: '配偶',
  children: '子女',
  parent: '父母',
  sibling: '兄弟姐妹',
  other: '其他'
};

const businessTypeNames = {
  apply: '办理',
  reissue: '补办',
  report_loss: '挂失',
  annual_review: '年审'
};

const communityNames = {
  all: '全部社区',
  community_001: '朝阳社区',
  community_002: '幸福社区',
  community_003: '和平社区',
  community_004: '新华社区',
  community_005: '胜利社区'
};

const reviewLevelNames = {
  regular_staff: '普通工作人员',
  senior_staff: '资深工作人员',
  supervisor: '主管'
};

function getLatestRuleVersion(businessType, communityId = 'all', handleDate = new Date().toISOString().split('T')[0]) {
  const businessRule = rules[businessType];
  if (!businessRule || !businessRule.versions) {
    return null;
  }

  const handleDateObj = new Date(handleDate);
  let matchedVersion = null;

  for (const version of businessRule.versions) {
    const effectiveDateObj = new Date(version.effectiveDate);
    if (effectiveDateObj > handleDateObj) {
      continue;
    }

    const appliesToAll = version.applicableCommunities.includes('all');
    const appliesToCommunity = version.applicableCommunities.includes(communityId);

    if (appliesToAll || appliesToCommunity) {
      if (!matchedVersion || effectiveDateObj > new Date(matchedVersion.effectiveDate)) {
        matchedVersion = version;
      }
    }
  }

  return matchedVersion;
}

function getRuleVersionByNumber(businessType, versionNumber) {
  const businessRule = rules[businessType];
  if (!businessRule || !businessRule.versions) {
    return null;
  }
  return businessRule.versions.find(v => v.version === versionNumber) || null;
}

function getAllRuleVersions(businessType) {
  const businessRule = rules[businessType];
  if (!businessRule || !businessRule.versions) {
    return [];
  }
  return businessRule.versions.map(v => ({
    version: v.version,
    effectiveDate: v.effectiveDate,
    applicableCommunities: v.applicableCommunities,
    businessType,
    businessName: businessTypeNames[businessType]
  }));
}

module.exports = {
  rules,
  materialNames,
  agentRelationNames,
  businessTypeNames,
  communityNames,
  reviewLevelNames,
  getLatestRuleVersion,
  getRuleVersionByNumber,
  getAllRuleVersions
};
