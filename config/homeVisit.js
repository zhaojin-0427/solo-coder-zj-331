const { communityNames } = require('./rules');
const cardTypes = require('./cardTypes');

const homeVisitStatus = {
  PENDING_DISPATCH: 'pending_dispatch',
  DISPATCHED: 'dispatched',
  ON_SITE: 'on_site',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired'
};

const homeVisitStatusNames = {
  pending_dispatch: '待派单',
  dispatched: '已派单',
  on_site: '上门中',
  completed: '已完成',
  cancelled: '已取消',
  expired: '已过期'
};

const mobilityLevels = {
  normal: { level: 'normal', name: '行动正常', description: '可正常行走，无需协助', score: 0 },
  mild: { level: 'mild', name: '轻度不便', description: '行走稍缓，可短距离移动', score: 1 },
  moderate: { level: 'moderate', name: '中度不便', description: '需借助拐杖或轮椅', score: 2 },
  severe: { level: 'severe', name: '重度不便', description: '卧床或完全无法自理', score: 3 }
};

const materialRiskLevels = {
  low: { level: 'low', name: '低风险', description: '材料齐全且风险低', score: 1, needsDualVerify: false, needsReviewer: false },
  medium: { level: 'medium', name: '中风险', description: '部分材料待核实', score: 2, needsDualVerify: false, needsReviewer: false },
  high: { level: 'high', name: '高风险', description: '材料缺失较多或需复核', score: 3, needsDualVerify: true, needsReviewer: false },
  critical: { level: 'critical', name: '极高风险', description: '高龄+材料缺失+需复核', score: 4, needsDualVerify: true, needsReviewer: true }
};

const fieldStaff = [
  {
    staffId: 'FS001', name: '张外勤', phone: '13800000001',
    communities: ['community_001', 'community_002'],
    skills: ['bus_card', 'senior_card', 'medical_card'],
    businessTypes: ['apply', 'reissue', 'report_loss', 'annual_review'],
    canReview: true,
    workDays: [1, 2, 3, 4, 5],
    dailyCapacity: 5,
    status: 'active'
  },
  {
    staffId: 'FS002', name: '李外勤', phone: '13800000002',
    communities: ['community_001', 'community_003'],
    skills: ['bus_card', 'senior_card'],
    businessTypes: ['apply', 'reissue', 'annual_review'],
    canReview: false,
    workDays: [1, 2, 3, 4, 5],
    dailyCapacity: 4,
    status: 'active'
  },
  {
    staffId: 'FS003', name: '王外勤', phone: '13800000003',
    communities: ['community_002', 'community_004'],
    skills: ['bus_card', 'senior_card', 'medical_card'],
    businessTypes: ['apply', 'reissue', 'report_loss', 'annual_review'],
    canReview: true,
    workDays: [0, 1, 2, 3, 4, 5, 6],
    dailyCapacity: 6,
    status: 'active'
  },
  {
    staffId: 'FS004', name: '赵外勤', phone: '13800000004',
    communities: ['community_003', 'community_005'],
    skills: ['senior_card', 'medical_card'],
    businessTypes: ['apply', 'reissue', 'annual_review'],
    canReview: false,
    workDays: [1, 2, 3, 4, 5],
    dailyCapacity: 4,
    status: 'active'
  },
  {
    staffId: 'FS005', name: '陈外勤', phone: '13800000005',
    communities: ['community_004', 'community_005'],
    skills: ['bus_card', 'senior_card', 'medical_card'],
    businessTypes: ['apply', 'reissue', 'report_loss', 'annual_review'],
    canReview: true,
    workDays: [1, 2, 3, 4, 5, 6],
    dailyCapacity: 5,
    status: 'active'
  }
];

const homeServiceScopes = {
  community_001: {
    communityId: 'community_001',
    communityName: communityNames.community_001,
    serviceArea: '朝阳社区全域',
    coveredBuildings: ['1号楼', '2号楼', '3号楼', '4号楼', '5号楼'],
    avgTravelTimeMinutes: 15,
    dailyMaxOrders: 10
  },
  community_002: {
    communityId: 'community_002',
    communityName: communityNames.community_002,
    serviceArea: '幸福社区全域',
    coveredBuildings: ['A栋', 'B栋', 'C栋', 'D栋'],
    avgTravelTimeMinutes: 20,
    dailyMaxOrders: 8
  },
  community_003: {
    communityId: 'community_003',
    communityName: communityNames.community_003,
    serviceArea: '和平社区全域',
    coveredBuildings: ['1号楼', '2号楼', '3号楼'],
    avgTravelTimeMinutes: 18,
    dailyMaxOrders: 7
  },
  community_004: {
    communityId: 'community_004',
    communityName: communityNames.community_004,
    serviceArea: '新华社区全域',
    coveredBuildings: ['东区', '西区', '南区', '北区'],
    avgTravelTimeMinutes: 25,
    dailyMaxOrders: 9
  },
  community_005: {
    communityId: 'community_005',
    communityName: communityNames.community_005,
    serviceArea: '胜利社区全域',
    coveredBuildings: ['1号楼', '2号楼', '3号楼', '4号楼', '5号楼', '6号楼'],
    avgTravelTimeMinutes: 22,
    dailyMaxOrders: 8
  }
};

const homeVisitTimeSlots = {
  morning: {
    id: 'morning',
    name: '上午',
    startTime: '09:00',
    endTime: '12:00',
    slotMinutes: 60,
    slots: ['09:00-10:00', '10:00-11:00', '11:00-12:00']
  },
  afternoon: {
    id: 'afternoon',
    name: '下午',
    startTime: '14:00',
    endTime: '17:00',
    slotMinutes: 60,
    slots: ['14:00-15:00', '15:00-16:00', '16:00-17:00']
  }
};

const homeVisitTimeSlotNames = {
  morning: '上午时段 (09:00-12:00)',
  afternoon: '下午时段 (14:00-17:00)',
  any: '任意时段'
};

const homeVisitCancelReasons = {
  user_cancel: '用户主动取消',
  material_missing: '材料不全取消',
  schedule_conflict: '时间冲突取消',
  staff_unavailable: '外勤人员不可用',
  out_of_scope: '不在服务范围',
  transferred_to_window: '转窗口办理',
  other: '其他原因'
};

const homeVisitFailReasons = {
  out_of_service_scope: '不在服务范围内',
  no_available_staff: '无可用外勤人员',
  daily_capacity_full: '当日工单容量已满',
  high_risk_requires_window: '高风险需窗口办理',
  material_insufficient: '材料不足无法上门',
  date_invalid: '预约日期无效',
  other: '其他原因'
};

const agentRelationNames = require('./rules').agentRelationNames;

function getHomeVisitBusinessTime(cardType, businessType, isReview = false, mobilityLevel = 'normal') {
  const baseTime = {
    bus_card: { apply: 25, reissue: 20, report_loss: 15, annual_review: 20 },
    senior_card: { apply: 30, reissue: 25, report_loss: 15, annual_review: 25 },
    medical_card: { apply: 20, reissue: 15, report_loss: 10, annual_review: 15 }
  };

  const cardConfig = baseTime[cardType];
  if (!cardConfig) return 30;

  let minutes = cardConfig[businessType] || 25;

  if (isReview) minutes += 15;

  const mobilityMultiplier = {
    normal: 1.0,
    mild: 1.1,
    moderate: 1.2,
    severe: 1.3
  };
  minutes = Math.round(minutes * (mobilityMultiplier[mobilityLevel] || 1.0));

  return minutes;
}

function getAllHomeVisitTimeSlots() {
  const slots = [];
  for (const period of Object.values(homeVisitTimeSlots)) {
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

function getFieldStaffByCommunity(communityId) {
  return fieldStaff.filter(s =>
    s.communities.includes(communityId) && s.status === 'active'
  );
}

function getServiceScope(communityId) {
  return homeServiceScopes[communityId] || null;
}

function getMaterialRiskLevel(missingCount, isReview, age) {
  let score = 0;

  if (missingCount === 0) score += 1;
  else if (missingCount === 1) score += 2;
  else if (missingCount === 2) score += 3;
  else score += 4;

  if (isReview) score += 1;
  if (age >= 80) score += 1;

  if (score <= 2) return { ...materialRiskLevels.low };
  if (score <= 3) return { ...materialRiskLevels.medium };
  if (score <= 4) return { ...materialRiskLevels.high };
  return { ...materialRiskLevels.critical };
}

function needsDualVerification(riskLevel, businessType) {
  if (riskLevel.needsDualVerify) return true;
  if (businessType === 'apply') return false;
  return false;
}

function needsReviewerCompanion(riskLevel, isReviewRequired) {
  if (riskLevel.needsReviewer) return true;
  if (isReviewRequired) return true;
  return false;
}

module.exports = {
  homeVisitStatus,
  homeVisitStatusNames,
  mobilityLevels,
  materialRiskLevels,
  fieldStaff,
  homeServiceScopes,
  homeVisitTimeSlots,
  homeVisitTimeSlotNames,
  homeVisitCancelReasons,
  homeVisitFailReasons,
  getHomeVisitBusinessTime,
  getAllHomeVisitTimeSlots,
  getFieldStaffByCommunity,
  getServiceScope,
  getMaterialRiskLevel,
  needsDualVerification,
  needsReviewerCompanion
};
