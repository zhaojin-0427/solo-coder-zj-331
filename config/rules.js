const rules = {
  apply: {
    name: '办理',
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
  },

  reissue: {
    name: '补办',
    bus_card: {
      requiredMaterials: ['id_card', 'photo'],
      mustBePresent: false,
      allowedAgents: ['spouse', 'children', 'parent', 'sibling'],
      agentRequiredMaterials: ['agent_id_card', 'proof_of_relationship'],
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
      agentRequiredMaterials: ['agent_id_card', 'proof_of_relationship'],
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
      agentRequiredMaterials: ['agent_id_card'],
      ageRequirement: 0,
      specialReminders: [
        '补办需缴纳工本费10元',
        '原卡内余额将转入新卡',
        '如遗忘卡号，可凭身份证查询'
      ]
    }
  },

  report_loss: {
    name: '挂失',
    bus_card: {
      requiredMaterials: ['id_card'],
      mustBePresent: false,
      allowedAgents: ['spouse', 'children', 'parent', 'sibling', 'other'],
      agentRequiredMaterials: ['agent_id_card'],
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
      agentRequiredMaterials: ['agent_id_card'],
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
      agentRequiredMaterials: ['agent_id_card'],
      ageRequirement: 0,
      specialReminders: [
        '挂失后即时生效',
        '可通过医院官网或APP自助挂失',
        '挂失后7天内可解挂'
      ]
    }
  },

  annual_review: {
    name: '年审',
    bus_card: {
      requiredMaterials: ['id_card', 'bus_card'],
      mustBePresent: false,
      allowedAgents: ['spouse', 'children', 'parent', 'sibling'],
      agentRequiredMaterials: ['agent_id_card'],
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
      agentRequiredMaterials: ['agent_id_card'],
      ageRequirement: 60,
      specialReminders: [
        '每两年需年审一次',
        '需确认持卡人健在且符合条件',
        '可到社区服务中心办理'
      ]
    },
    medical_card: {
      requiredMaterials: [],
      mustBePresent: false,
      allowedAgents: [],
      agentRequiredMaterials: [],
      ageRequirement: 0,
      specialReminders: ['就诊卡无需年审']
    }
  }
};

const materialNames = {
  id_card: '身份证',
  photo: '一寸免冠照片',
  household_register: '户口本/居住证明',
  bus_card: '公交卡原件',
  senior_card: '老年卡原件',
  medical_card: '就诊卡原件',
  agent_id_card: '代办人身份证',
  proof_of_relationship: '关系证明（户口本/结婚证等）'
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

module.exports = {
  rules,
  materialNames,
  agentRelationNames,
  businessTypeNames
};
