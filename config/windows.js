const { communityNames } = require('./rules');
const cardTypes = require('./cardTypes');

const windowTypes = {
  general: {
    id: 'general',
    name: '综合窗口',
    description: '可办理各类常规业务',
    supportedCardTypes: ['bus_card', 'senior_card', 'medical_card'],
    supportedBusinessTypes: ['apply', 'reissue', 'report_loss', 'annual_review']
  },
  senior: {
    id: 'senior',
    name: '高龄专窗',
    description: '高龄老人优先，处理特殊复核业务',
    supportedCardTypes: ['bus_card', 'senior_card'],
    supportedBusinessTypes: ['apply', 'reissue', 'annual_review'],
    agePreference: 75
  },
  agent: {
    id: 'agent',
    name: '代办窗口',
    description: '专门处理各类代办业务',
    supportedCardTypes: ['bus_card', 'senior_card', 'medical_card'],
    supportedBusinessTypes: ['apply', 'reissue', 'report_loss', 'annual_review'],
    agentOnly: true
  },
  review: {
    id: 'review',
    name: '复核窗口',
    description: '需要主管复核的业务窗口',
    supportedCardTypes: ['bus_card', 'senior_card', 'medical_card'],
    supportedBusinessTypes: ['apply', 'reissue', 'annual_review'],
    reviewRequired: true
  }
};

const businessTimeConfig = {
  bus_card: {
    apply: { baseMinutes: 15, agentExtra: 5, reviewExtra: 10, description: '公交卡办理' },
    reissue: { baseMinutes: 12, agentExtra: 5, reviewExtra: 8, description: '公交卡补办' },
    report_loss: { baseMinutes: 8, agentExtra: 3, reviewExtra: 0, description: '公交卡挂失' },
    annual_review: { baseMinutes: 10, agentExtra: 5, reviewExtra: 10, description: '公交卡年审' }
  },
  senior_card: {
    apply: { baseMinutes: 18, agentExtra: 6, reviewExtra: 12, description: '老年卡办理' },
    reissue: { baseMinutes: 15, agentExtra: 5, reviewExtra: 10, description: '老年卡补办' },
    report_loss: { baseMinutes: 10, agentExtra: 3, reviewExtra: 0, description: '老年卡挂失' },
    annual_review: { baseMinutes: 12, agentExtra: 5, reviewExtra: 15, description: '老年卡年审' }
  },
  medical_card: {
    apply: { baseMinutes: 10, agentExtra: 3, reviewExtra: 0, description: '就诊卡办理' },
    reissue: { baseMinutes: 8, agentExtra: 3, reviewExtra: 0, description: '就诊卡补办' },
    report_loss: { baseMinutes: 5, agentExtra: 2, reviewExtra: 0, description: '就诊卡挂失' }
  }
};

const communityWindows = {
  community_001: {
    communityName: communityNames.community_001,
    windows: [
      { windowId: 'C1_W1', type: 'general', capacity: 2 },
      { windowId: 'C1_W2', type: 'general', capacity: 2 },
      { windowId: 'C1_W3', type: 'senior', capacity: 1 },
      { windowId: 'C1_W4', type: 'agent', capacity: 1 },
      { windowId: 'C1_W5', type: 'review', capacity: 1 }
    ],
    totalCapacity: 7
  },
  community_002: {
    communityName: communityNames.community_002,
    windows: [
      { windowId: 'C2_W1', type: 'general', capacity: 2 },
      { windowId: 'C2_W2', type: 'general', capacity: 2 },
      { windowId: 'C2_W3', type: 'senior', capacity: 1 },
      { windowId: 'C2_W4', type: 'agent', capacity: 1 }
    ],
    totalCapacity: 6
  },
  community_003: {
    communityName: communityNames.community_003,
    windows: [
      { windowId: 'C3_W1', type: 'general', capacity: 2 },
      { windowId: 'C3_W2', type: 'senior', capacity: 1 },
      { windowId: 'C3_W3', type: 'agent', capacity: 1 },
      { windowId: 'C3_W4', type: 'review', capacity: 1 }
    ],
    totalCapacity: 5
  },
  community_004: {
    communityName: communityNames.community_004,
    windows: [
      { windowId: 'C4_W1', type: 'general', capacity: 2 },
      { windowId: 'C4_W2', type: 'general', capacity: 2 },
      { windowId: 'C4_W3', type: 'senior', capacity: 1 },
      { windowId: 'C4_W4', type: 'review', capacity: 1 }
    ],
    totalCapacity: 6
  },
  community_005: {
    communityName: communityNames.community_005,
    windows: [
      { windowId: 'C5_W1', type: 'general', capacity: 2 },
      { windowId: 'C5_W2', type: 'senior', capacity: 1 },
      { windowId: 'C5_W3', type: 'agent', capacity: 1 }
    ],
    totalCapacity: 4
  },
  all: {
    communityName: communityNames.all,
    windows: [
      { windowId: 'ALL_W1', type: 'general', capacity: 3 },
      { windowId: 'ALL_W2', type: 'general', capacity: 3 },
      { windowId: 'ALL_W3', type: 'senior', capacity: 2 },
      { windowId: 'ALL_W4', type: 'agent', capacity: 2 },
      { windowId: 'ALL_W5', type: 'review', capacity: 2 }
    ],
    totalCapacity: 12
  }
};

const timeSlots = {
  morning: {
    id: 'morning',
    name: '上午',
    startTime: '09:00',
    endTime: '12:00',
    slotMinutes: 30,
    slots: ['09:00-09:30', '09:30-10:00', '10:00-10:30', '10:30-11:00', '11:00-11:30', '11:30-12:00']
  },
  afternoon: {
    id: 'afternoon',
    name: '下午',
    startTime: '13:30',
    endTime: '17:00',
    slotMinutes: 30,
    slots: ['13:30-14:00', '14:00-14:30', '14:30-15:00', '15:00-15:30', '15:30-16:00', '16:00-16:30', '16:30-17:00']
  }
};

const timeSlotNames = {
  morning: '上午时段 (09:00-12:00)',
  afternoon: '下午时段 (13:30-17:00)',
  any: '任意时段'
};

const appointmentStatus = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
  FAILED: 'failed'
};

const appointmentStatusNames = {
  pending: '待确认',
  confirmed: '已确认',
  cancelled: '已取消',
  expired: '已过期',
  failed: '预约失败'
};

const failReasons = {
  rule_not_passed: '规则校验不通过',
  material_missing: '材料不全',
  material_expired: '材料过期',
  agent_invalid: '代办不符合要求',
  age_not_met: '年龄不符合要求',
  presence_required: '需本人到场',
  no_available_window: '无可用窗口',
  date_invalid: '预约日期无效',
  duplicate: '重复预约',
  other: '其他原因'
};

const cancelReasons = {
  user_cancel: '用户主动取消',
  material_missing: '材料不全取消',
  schedule_conflict: '时间冲突取消',
  rule_change: '规则变更取消',
  other: '其他原因'
};

const agentComplexityLevels = {
  low: { level: 'low', name: '低复杂度', factor: 1.0, relations: ['spouse', 'children'] },
  medium: { level: 'medium', name: '中复杂度', factor: 1.2, relations: ['parent', 'sibling'] },
  high: { level: 'high', name: '高复杂度', factor: 1.5, relations: ['other'] }
};

function getBusinessTime(cardType, businessType, isAgent = false, isReview = false, agentRelation = null) {
  const cardConfig = businessTimeConfig[cardType];
  if (!cardConfig) return 15;

  const businessConfig = cardConfig[businessType];
  if (!businessConfig) return 15;

  let minutes = businessConfig.baseMinutes;

  if (isAgent) {
    minutes += businessConfig.agentExtra;
    let complexity = agentComplexityLevels.low;
    if (agentRelation) {
      for (const [key, level] of Object.entries(agentComplexityLevels)) {
        if (level.relations.includes(agentRelation)) {
          complexity = level;
          break;
        }
      }
    }
    minutes = Math.round(minutes * complexity.factor);
  }

  if (isReview) {
    minutes += businessConfig.reviewExtra;
  }

  return minutes;
}

function getCommunityWindowConfig(communityId) {
  return communityWindows[communityId] || communityWindows.all;
}

function getSuitableWindows(communityId, cardType, businessType, isAgent = false, isReview = false, age = 0) {
  const config = getCommunityWindowConfig(communityId);
  if (!config) return [];

  const suitable = [];

  for (const win of config.windows) {
    const typeConfig = windowTypes[win.type];
    if (!typeConfig) continue;

    if (!typeConfig.supportedCardTypes.includes(cardType)) continue;
    if (!typeConfig.supportedBusinessTypes.includes(businessType)) continue;

    if (typeConfig.agentOnly && !isAgent) continue;
    if (typeConfig.reviewRequired && !isReview) continue;

    let priorityScore = 0;
    if (typeConfig.agePreference && age >= typeConfig.agePreference) {
      priorityScore += 50;
    }
    if (isAgent && win.type === 'agent') priorityScore += 30;
    if (isReview && win.type === 'review') priorityScore += 30;
    if (win.type === 'general') priorityScore += 10;

    priorityScore += win.capacity * 5;

    suitable.push({
      windowId: win.windowId,
      type: win.type,
      typeName: typeConfig.name,
      typeDescription: typeConfig.description,
      capacity: win.capacity,
      priorityScore,
      communityId,
      communityName: config.communityName
    });
  }

  return suitable.sort((a, b) => b.priorityScore - a.priorityScore);
}

function getAllTimeSlots() {
  const slots = [];
  for (const period of Object.values(timeSlots)) {
    for (const slot of period.slots) {
      slots.push({
        slot,
        period: period.id,
        periodName: period.name,
        startTime: slot.split('-')[0],
        endTime: slot.split('-')[1]
      });
    }
  }
  return slots;
}

function getAgentComplexity(agentRelation) {
  for (const [key, level] of Object.entries(agentComplexityLevels)) {
    if (level.relations.includes(agentRelation)) {
      return { ...level };
    }
  }
  return { ...agentComplexityLevels.low };
}

module.exports = {
  windowTypes,
  businessTimeConfig,
  communityWindows,
  timeSlots,
  timeSlotNames,
  appointmentStatus,
  appointmentStatusNames,
  failReasons,
  cancelReasons,
  agentComplexityLevels,
  getBusinessTime,
  getCommunityWindowConfig,
  getSuitableWindows,
  getAllTimeSlots,
  getAgentComplexity
};
