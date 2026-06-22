const fs = require('fs');
const path = require('path');

const { matchRule } = require('./ruleService');
const { canArchiveSuccessful } = require('../utils/validator');
const { communityNames, businessTypeNames, materialNames, agentRelationNames } = require('../config/rules');
const cardTypes = require('../config/cardTypes');
const {
  homeVisitStatus,
  homeVisitStatusNames,
  mobilityLevels,
  materialRiskLevels,
  fieldStaff,
  homeVisitCancelReasons,
  homeVisitFailReasons,
  getHomeVisitBusinessTime,
  getAllHomeVisitTimeSlots,
  getFieldStaffByCommunity,
  getServiceScope,
  getMaterialRiskLevel,
  needsDualVerification,
  needsReviewerCompanion,
  homeVisitTimeSlots
} = require('../config/homeVisit');

const DATA_FILE = path.join(__dirname, '../data/homeVisitOrders.json');

let ordersCache = null;

function ensureDataFile() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
  }
}

function loadOrders() {
  if (ordersCache) {
    return ordersCache;
  }
  ensureDataFile();
  try {
    const content = fs.readFileSync(DATA_FILE, 'utf-8');
    ordersCache = JSON.parse(content);
  } catch (e) {
    ordersCache = [];
  }
  return ordersCache;
}

function saveOrders(records) {
  ordersCache = records;
  fs.writeFileSync(DATA_FILE, JSON.stringify(records, null, 2));
}

function generateId() {
  return 'HVO' + Date.now().toString() + Math.random().toString(36).slice(2, 8).toUpperCase();
}

function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.ceil(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24));
}

function extractIdCardKey(materials) {
  if (!materials || !Array.isArray(materials)) return null;
  const idCard = materials.find(m => m.key === 'id_card');
  if (idCard && idCard.idNumber) return idCard.idNumber;
  if (idCard && idCard.cardNumber) return idCard.cardNumber;
  return null;
}

function expireOldOrders() {
  const records = loadOrders();
  const today = new Date().toISOString().split('T')[0];
  let changed = false;

  for (const rec of records) {
    if ((rec.status === homeVisitStatus.PENDING_DISPATCH || rec.status === homeVisitStatus.DISPATCHED)
        && rec.expectedDate < today) {
      rec.status = homeVisitStatus.EXPIRED;
      rec.statusName = homeVisitStatusNames[homeVisitStatus.EXPIRED];
      rec.statusHistory = rec.statusHistory || [];
      rec.statusHistory.push({
        status: homeVisitStatus.EXPIRED,
        time: new Date().toISOString(),
        reason: '上门日期已过期'
      });
      changed = true;
    }
  }

  if (changed) {
    saveOrders(records);
  }
}

function countStaffDailyLoad(staffId, expectedDate) {
  expireOldOrders();
  const records = loadOrders();
  const activeStatuses = [homeVisitStatus.PENDING_DISPATCH, homeVisitStatus.DISPATCHED, homeVisitStatus.ON_SITE];
  let count = 0;

  for (const rec of records) {
    if (!activeStatuses.includes(rec.status)) continue;
    if (rec.expectedDate !== expectedDate) continue;
    if (rec.assignedStaffId === staffId || (rec.secondaryStaffId && rec.secondaryStaffId === staffId)) {
      count++;
    }
  }

  return count;
}

function countCommunityDailyOrders(communityId, expectedDate) {
  expireOldOrders();
  const records = loadOrders();
  const activeStatuses = [homeVisitStatus.PENDING_DISPATCH, homeVisitStatus.DISPATCHED, homeVisitStatus.ON_SITE];
  let count = 0;

  for (const rec of records) {
    if (!activeStatuses.includes(rec.status)) continue;
    if (rec.communityId !== communityId) continue;
    if (rec.expectedDate !== expectedDate) continue;
    count++;
  }

  return count;
}

function evaluateHomeVisit(params) {
  const {
    cardType,
    businessType,
    age,
    mobilityLevel,
    address,
    contactPerson,
    contactPhone,
    availableDates,
    preferredTimeSlot,
    materials,
    materialKeys,
    agentRelation,
    communityId
  } = params;

  const result = {
    canDispatch: false,
    rulePassed: false,
    ruleCheckResult: null,
    recommendedStaff: null,
    alternativeStaff: [],
    recommendedTimeSlot: null,
    alternativeTimeSlots: [],
    estimatedServiceMinutes: 0,
    estimatedTotalMinutes: 0,
    cannotDispatchReasons: [],
    supplementaryMaterials: [],
    riskTips: [],
    windowSuggestions: [],
    isReviewRequired: false,
    needsDualVerify: false,
    needsReviewerCompanion: false,
    materialRiskLevel: null,
    serviceScopeCheck: null
  };

  const serviceScope = getServiceScope(communityId);
  result.serviceScopeCheck = serviceScope ? {
    inScope: true,
    communityId,
    communityName: communityNames[communityId] || communityId,
    serviceArea: serviceScope.serviceArea,
    avgTravelTimeMinutes: serviceScope.avgTravelTimeMinutes,
    dailyMaxOrders: serviceScope.dailyMaxOrders
  } : { inScope: false, reason: '该社区暂未开通上门服务' };

  if (!serviceScope) {
    result.cannotDispatchReasons.push('该社区暂未开通上门服务');
    result.windowSuggestions.push(`建议前往${communityNames[communityId] || '附近社区'}服务中心窗口办理`);
    return result;
  }

  const ruleResult = matchRule(cardType, businessType, {
    age,
    isPresent: false,
    agentRelation,
    materialKeys,
    materials,
    communityId,
    handleDate: availableDates && availableDates.length > 0 ? availableDates[0] : new Date().toISOString().split('T')[0]
  });

  result.ruleCheckResult = {
    canProceed: ruleResult.canProceed,
    canProceedSuccessfully: canArchiveSuccessful(ruleResult),
    errors: ruleResult.errors,
    missingMaterials: ruleResult.missingMaterials,
    expiredMaterials: ruleResult.expiredMaterials,
    seniorReview: ruleResult.seniorReview,
    specialReminders: ruleResult.specialReminders,
    ruleVersion: ruleResult.ruleVersion
  };

  result.rulePassed = canArchiveSuccessful(ruleResult);
  result.isReviewRequired = ruleResult.seniorReview?.reviewRequired || false;

  const missingCount = (ruleResult.missingMaterials?.length || 0) + (ruleResult.expiredMaterials?.length || 0);
  const riskLevel = getMaterialRiskLevel(missingCount, result.isReviewRequired, age);
  result.materialRiskLevel = riskLevel;

  result.needsDualVerify = needsDualVerification(riskLevel, businessType);
  result.needsReviewerCompanion = needsReviewerCompanion(riskLevel, result.isReviewRequired);

  if (ruleResult.missingMaterials && ruleResult.missingMaterials.length > 0) {
    result.supplementaryMaterials = ruleResult.missingMaterials.map(m => ({
      ...m,
      hint: `请准备：${m.name}，上门时需核验原件`
    }));
  }
  if (ruleResult.expiredMaterials && ruleResult.expiredMaterials.length > 0) {
    result.supplementaryMaterials.push(
      ...ruleResult.expiredMaterials.map(m => ({
        ...m,
        isExpired: true,
        hint: `请更新：${m.name}（已过期）`
      }))
    );
  }

  if (!ruleResult.canProceed && missingCount > 2) {
    result.cannotDispatchReasons.push('材料缺失较多，建议先到窗口办理');
    result.windowSuggestions.push('材料缺失较多，建议携带完整材料前往社区服务中心窗口办理');
  }

  if (riskLevel.level === 'critical') {
    result.riskTips.push('极高风险等级，建议优先选择窗口办理');
    result.windowSuggestions.push('高龄+需复核+材料待补充，建议到窗口办理以确保业务顺利完成');
  } else if (riskLevel.level === 'high') {
    result.riskTips.push('高风险等级，需双人核验');
  }

  const eligibleStaff = getFieldStaffByCommunity(communityId).filter(staff => {
    if (!staff.skills.includes(cardType)) return false;
    if (!staff.businessTypes.includes(businessType)) return false;
    if (result.needsReviewerCompanion && !staff.canReview) return false;
    return true;
  });

  if (eligibleStaff.length === 0) {
    result.cannotDispatchReasons.push('该社区暂无匹配的外勤人员');
    result.windowSuggestions.push('暂无合适外勤人员，建议前往窗口办理');
    return result;
  }

  if (result.needsDualVerify && eligibleStaff.length < 2) {
    result.cannotDispatchReasons.push('需双人核验但外勤人员不足');
    result.windowSuggestions.push('该业务需双人核验但人手不足，建议窗口办理');
    return result;
  }

  result.estimatedServiceMinutes = getHomeVisitBusinessTime(
    cardType,
    businessType,
    result.isReviewRequired,
    mobilityLevel || 'normal'
  );
  result.estimatedTotalMinutes = result.estimatedServiceMinutes + serviceScope.avgTravelTimeMinutes;

  const bestDate = availableDates && availableDates.length > 0 ? availableDates[0] : null;
  if (!bestDate) {
    result.cannotDispatchReasons.push('请选择可上门日期');
    return result;
  }

  const today = new Date().toISOString().split('T')[0];
  if (bestDate < today) {
    result.cannotDispatchReasons.push('上门日期不能早于今日');
    return result;
  }
  if (daysBetween(today, bestDate) > 30) {
    result.cannotDispatchReasons.push('上门日期不能超过30天');
    return result;
  }

  const dateObj = new Date(bestDate);
  const dayOfWeek = dateObj.getDay();

  const availableStaff = eligibleStaff.filter(staff => staff.workDays.includes(dayOfWeek));

  if (availableStaff.length === 0) {
    result.cannotDispatchReasons.push('所选日期无可排班外勤人员');
    const nextWorkDay = findNextWorkDay(bestDate, eligibleStaff);
    if (nextWorkDay) {
      result.windowSuggestions.push(`建议选择${nextWorkDay}或前往窗口办理`);
    } else {
      result.windowSuggestions.push('建议前往窗口办理');
    }
    return result;
  }

  const dailyOrders = countCommunityDailyOrders(communityId, bestDate);
  if (dailyOrders >= serviceScope.dailyMaxOrders) {
    result.cannotDispatchReasons.push('当日上门工单容量已满');
    result.windowSuggestions.push('当日工单已满，建议改期或前往窗口办理');
    return result;
  }

  const staffWithLoad = availableStaff.map(staff => {
    const load = countStaffDailyLoad(staff.staffId, bestDate);
    const loadRatio = load / staff.dailyCapacity;
    const score = 100 - loadRatio * 80 + (staff.canReview ? 10 : 0);
    return {
      ...staff,
      dailyLoad: load,
      loadRatio: Number((loadRatio * 100).toFixed(1)),
      remainingCapacity: Math.max(0, staff.dailyCapacity - load),
      score
    };
  }).sort((a, b) => b.score - a.score);

  result.recommendedStaff = staffWithLoad[0] || null;
  result.alternativeStaff = staffWithLoad.slice(1, 4);

  const allSlots = getAllHomeVisitTimeSlots();
  const preferredPeriod = preferredTimeSlot === 'morning' ? 'morning' :
    preferredTimeSlot === 'afternoon' ? 'afternoon' : 'any';

  const scoredSlots = allSlots.map(slot => {
    let score = 50;
    if (preferredPeriod !== 'any' && slot.period === preferredPeriod) {
      score += 30;
    }
    if (slot.startTime === '10:00' || slot.startTime === '15:00') {
      score += 10;
    }
    return {
      ...slot,
      score,
      available: true
    };
  }).sort((a, b) => b.score - a.score);

  result.recommendedTimeSlot = scoredSlots[0] || null;
  result.alternativeTimeSlots = scoredSlots.slice(1, 4);

  if (mobilityLevel === 'severe') {
    result.riskTips.push('行动能力重度不便，上门时需特别注意老人安全');
  } else if (mobilityLevel === 'moderate') {
    result.riskTips.push('行动能力中度不便，请外勤人员做好协助准备');
  }

  if (age >= 80) {
    result.riskTips.push('高龄老人，建议家属在场配合办理');
  }

  if (result.supplementaryMaterials.length > 0) {
    result.riskTips.push(`存在${result.supplementaryMaterials.length}项待补充材料，上门时需重点核验`);
  }

  if (result.needsDualVerify) {
    result.riskTips.push('本单需双人核验，将安排两位外勤人员同行');
  }

  if (result.needsReviewerCompanion) {
    result.riskTips.push('需复核人员同行，将安排具备复核资质的外勤人员');
  }

  if (result.supplementaryMaterials.length > 0 && ruleResult.canProceed) {
    result.windowSuggestions.push('如材料准备不齐全，也可携带现有材料前往窗口办理');
  }

  result.canDispatch = true;
  return result;
}

function findNextWorkDay(fromDate, staffList) {
  const date = new Date(fromDate);
  for (let i = 1; i <= 14; i++) {
    date.setDate(date.getDate() + 1);
    const dayOfWeek = date.getDay();
    const hasAvailable = staffList.some(s => s.workDays.includes(dayOfWeek));
    if (hasAvailable) {
      return date.toISOString().split('T')[0];
    }
  }
  return null;
}

function createHomeVisitOrder(params) {
  expireOldOrders();

  const {
    cardType,
    businessType,
    age,
    mobilityLevel = 'normal',
    address,
    contactPerson,
    contactPhone,
    availableDates,
    preferredTimeSlot = 'any',
    materials = [],
    materialKeys,
    agentRelation,
    communityId,
    operatorId = 'system',
    operatorName = '系统',
    applicantName,
    remarks = null
  } = params;

  const materialsList = materials || [];
  const keysList = materialKeys || materialsList.map(m => m.key);
  const idCardKey = extractIdCardKey(materialsList);

  const evaluateParams = {
    cardType,
    businessType,
    age,
    mobilityLevel,
    address,
    contactPerson,
    contactPhone,
    availableDates,
    preferredTimeSlot,
    materials: materialsList,
    materialKeys: keysList,
    agentRelation,
    communityId
  };

  const evaluation = evaluateHomeVisit(evaluateParams);

  const records = loadOrders();
  const expectedDate = availableDates && availableDates.length > 0 ? availableDates[0] : null;

  const order = {
    id: generateId(),
    cardType,
    cardName: cardTypes[cardType]?.name || cardType,
    businessType,
    businessName: businessTypeNames[businessType] || businessType,
    age,
    mobilityLevel,
    mobilityLevelName: mobilityLevels[mobilityLevel]?.name || mobilityLevel,
    address,
    contactPerson,
    contactPhone,
    availableDates: availableDates || [],
    preferredTimeSlot,
    communityId,
    communityName: communityNames[communityId] || communityId,
    expectedDate,
    expectedTimeSlot: evaluation.recommendedTimeSlot?.slot || null,
    expectedTimePeriod: evaluation.recommendedTimeSlot?.period || null,
    agentRelation: agentRelation || null,
    agentRelationName: agentRelation ? (agentRelationNames[agentRelation] || agentRelation) : null,
    materials: materialsList,
    materialKeys: keysList,
    idCardKey,
    applicantName: applicantName || contactPerson,
    isReviewRequired: evaluation.isReviewRequired,
    needsDualVerify: evaluation.needsDualVerify,
    needsReviewerCompanion: evaluation.needsReviewerCompanion,
    materialRiskLevel: evaluation.materialRiskLevel?.level || 'low',
    materialRiskLevelName: evaluation.materialRiskLevel?.name || '低风险',
    estimatedServiceMinutes: evaluation.estimatedServiceMinutes,
    estimatedTotalMinutes: evaluation.estimatedTotalMinutes,
    assignedStaffId: evaluation.canDispatch ? evaluation.recommendedStaff?.staffId || null : null,
    assignedStaffName: evaluation.canDispatch ? evaluation.recommendedStaff?.name || null : null,
    assignedStaffPhone: evaluation.canDispatch ? evaluation.recommendedStaff?.phone || null : null,
    secondaryStaffId: evaluation.canDispatch && evaluation.needsDualVerify && evaluation.alternativeStaff.length > 0
      ? evaluation.alternativeStaff[0].staffId : null,
    secondaryStaffName: evaluation.canDispatch && evaluation.needsDualVerify && evaluation.alternativeStaff.length > 0
      ? evaluation.alternativeStaff[0].name : null,
    status: evaluation.canDispatch ? homeVisitStatus.PENDING_DISPATCH : homeVisitStatus.CANCELLED,
    statusName: evaluation.canDispatch
      ? homeVisitStatusNames[homeVisitStatus.PENDING_DISPATCH]
      : homeVisitStatusNames[homeVisitStatus.CANCELLED],
    statusHistory: [
      {
        status: evaluation.canDispatch ? homeVisitStatus.PENDING_DISPATCH : homeVisitStatus.CANCELLED,
        time: new Date().toISOString(),
        operatorId,
        operatorName,
        remark: evaluation.canDispatch ? '创建上门工单' : '工单创建失败：' + (evaluation.cannotDispatchReasons[0] || '无法派单')
      }
    ],
    failReasonCodes: evaluation.canDispatch ? [] : determineFailReasons(evaluation),
    failReasons: evaluation.canDispatch ? [] : evaluation.cannotDispatchReasons,
    cancelReasonCode: evaluation.canDispatch ? null : 'other',
    cancelReason: evaluation.canDispatch ? null : evaluation.cannotDispatchReasons[0] || '无法派单',
    cannotDispatchReasons: evaluation.cannotDispatchReasons,
    supplementaryMaterials: evaluation.supplementaryMaterials,
    riskTips: evaluation.riskTips,
    windowSuggestions: evaluation.windowSuggestions,
    completionResult: null,
    completedAt: null,
    completedBy: null,
    transferredToWindow: false,
    transferReason: null,
    operatorId,
    operatorName,
    remarks,
    evaluationSnapshot: {
      canDispatch: evaluation.canDispatch,
      rulePassed: evaluation.rulePassed,
      recommendedStaff: evaluation.recommendedStaff,
      recommendedTimeSlot: evaluation.recommendedTimeSlot,
      materialRiskLevel: evaluation.materialRiskLevel,
      riskTips: evaluation.riskTips,
      serviceScopeCheck: evaluation.serviceScopeCheck
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  records.unshift(order);
  saveOrders(records);

  return {
    success: evaluation.canDispatch,
    order,
    evaluation
  };
}

function determineFailReasons(evaluation) {
  const reasons = [];
  if (!evaluation.serviceScopeCheck?.inScope) reasons.push('out_of_service_scope');
  if (evaluation.cannotDispatchReasons.some(r => r.includes('外勤人员'))) reasons.push('no_available_staff');
  if (evaluation.cannotDispatchReasons.some(r => r.includes('容量已满'))) reasons.push('daily_capacity_full');
  if (evaluation.materialRiskLevel?.level === 'critical') reasons.push('high_risk_requires_window');
  if (evaluation.supplementaryMaterials?.length > 2) reasons.push('material_insufficient');
  if (evaluation.cannotDispatchReasons.some(r => r.includes('日期'))) reasons.push('date_invalid');
  if (reasons.length === 0) reasons.push('other');
  return reasons;
}

function dispatchOrder(id, staffId, operatorId = 'system', operatorName = '系统', remark = null) {
  expireOldOrders();
  const records = loadOrders();
  const order = records.find(r => r.id === id);

  if (!order) {
    return { success: false, reason: '工单不存在' };
  }

  if (order.status !== homeVisitStatus.PENDING_DISPATCH) {
    return {
      success: false,
      reason: `当前状态为${homeVisitStatusNames[order.status]}，不可派单`,
      currentStatus: order.status
    };
  }

  const staff = fieldStaff.find(s => s.staffId === staffId);
  if (!staff || staff.status !== 'active') {
    return { success: false, reason: '外勤人员不存在或未激活' };
  }

  if (!staff.communities.includes(order.communityId)) {
    return { success: false, reason: '该外勤人员不服务此社区' };
  }

  order.status = homeVisitStatus.DISPATCHED;
  order.statusName = homeVisitStatusNames[homeVisitStatus.DISPATCHED];
  order.assignedStaffId = staff.staffId;
  order.assignedStaffName = staff.name;
  order.assignedStaffPhone = staff.phone;
  order.dispatchedAt = new Date().toISOString();
  order.dispatchedBy = { operatorId, operatorName };
  order.statusHistory.push({
    status: homeVisitStatus.DISPATCHED,
    time: new Date().toISOString(),
    operatorId,
    operatorName,
    remark: remark || `派单给${staff.name}`
  });
  order.updatedAt = new Date().toISOString();

  saveOrders(records);
  return { success: true, order };
}

function startOnSite(id, operatorId = 'system', operatorName = '系统', remark = null) {
  expireOldOrders();
  const records = loadOrders();
  const order = records.find(r => r.id === id);

  if (!order) {
    return { success: false, reason: '工单不存在' };
  }

  if (order.status !== homeVisitStatus.DISPATCHED) {
    return {
      success: false,
      reason: `当前状态为${homeVisitStatusNames[order.status]}，不可开始上门`,
      currentStatus: order.status
    };
  }

  order.status = homeVisitStatus.ON_SITE;
  order.statusName = homeVisitStatusNames[homeVisitStatus.ON_SITE];
  order.arrivedAt = new Date().toISOString();
  order.statusHistory.push({
    status: homeVisitStatus.ON_SITE,
    time: new Date().toISOString(),
    operatorId,
    operatorName,
    remark: remark || '开始上门服务'
  });
  order.updatedAt = new Date().toISOString();

  saveOrders(records);
  return { success: true, order };
}

function completeOrder(id, resultData, operatorId = 'system', operatorName = '系统') {
  expireOldOrders();
  const records = loadOrders();
  const order = records.find(r => r.id === id);

  if (!order) {
    return { success: false, reason: '工单不存在' };
  }

  const validStatuses = [homeVisitStatus.DISPATCHED, homeVisitStatus.ON_SITE];
  if (!validStatuses.includes(order.status)) {
    return {
      success: false,
      reason: `当前状态为${homeVisitStatusNames[order.status]}，不可完成`,
      currentStatus: order.status
    };
  }

  const {
    isSuccess,
    failureReason,
    transferredToWindow = false,
    transferReason,
    actualServiceMinutes,
    materialsVerified,
    materialsMissing,
    notes,
    nextWindowSuggestion
  } = resultData || {};

  order.status = homeVisitStatus.COMPLETED;
  order.statusName = homeVisitStatusNames[homeVisitStatus.COMPLETED];
  order.completedAt = new Date().toISOString();
  order.completedBy = { operatorId, operatorName };

  order.completionResult = {
    isSuccess: !!isSuccess,
    failureReason: failureReason || null,
    transferredToWindow: !!transferredToWindow,
    transferReason: transferReason || null,
    actualServiceMinutes: actualServiceMinutes || order.estimatedServiceMinutes,
    materialsVerified: materialsVerified || [],
    materialsMissing: materialsMissing || [],
    notes: notes || null,
    nextWindowSuggestion: nextWindowSuggestion || null
  };

  order.transferredToWindow = !!transferredToWindow;
  order.transferReason = transferReason || null;

  order.statusHistory.push({
    status: homeVisitStatus.COMPLETED,
    time: new Date().toISOString(),
    operatorId,
    operatorName,
    remark: isSuccess ? '上门服务完成' : (`上门服务未完成：${failureReason || '未知原因'}`)
  });
  order.updatedAt = new Date().toISOString();

  saveOrders(records);
  return { success: true, order };
}

function cancelOrder(id, reasonCode = 'other', reason = null, remark = null, operatorId = 'system', operatorName = '系统') {
  expireOldOrders();
  const records = loadOrders();
  const order = records.find(r => r.id === id);

  if (!order) {
    return { success: false, reason: '工单不存在' };
  }

  const terminalStatuses = [homeVisitStatus.CANCELLED, homeVisitStatus.EXPIRED, homeVisitStatus.COMPLETED];
  if (terminalStatuses.includes(order.status)) {
    return {
      success: false,
      reason: `当前状态为${homeVisitStatusNames[order.status]}，不可重复取消`,
      currentStatus: order.status
    };
  }

  order.status = homeVisitStatus.CANCELLED;
  order.statusName = homeVisitStatusNames[homeVisitStatus.CANCELLED];
  order.cancelReasonCode = reasonCode;
  order.cancelReason = reason || homeVisitCancelReasons[reasonCode] || '其他原因';
  order.cancelRemark = remark;
  order.cancelledAt = new Date().toISOString();
  order.cancelledBy = { operatorId, operatorName };
  order.statusHistory.push({
    status: homeVisitStatus.CANCELLED,
    time: new Date().toISOString(),
    operatorId,
    operatorName,
    reasonCode,
    reason: order.cancelReason,
    remark
  });
  order.updatedAt = new Date().toISOString();

  saveOrders(records);
  return { success: true, order };
}

function reassignOrder(id, newStaffId, operatorId = 'system', operatorName = '系统', remark = null) {
  expireOldOrders();
  const records = loadOrders();
  const order = records.find(r => r.id === id);

  if (!order) {
    return { success: false, reason: '工单不存在' };
  }

  if (order.status === homeVisitStatus.COMPLETED ||
      order.status === homeVisitStatus.CANCELLED ||
      order.status === homeVisitStatus.EXPIRED) {
    return {
      success: false,
      reason: `当前状态为${homeVisitStatusNames[order.status]}，不可改派`,
      currentStatus: order.status
    };
  }

  const newStaff = fieldStaff.find(s => s.staffId === newStaffId);
  if (!newStaff || newStaff.status !== 'active') {
    return { success: false, reason: '新外勤人员不存在或未激活' };
  }

  if (!newStaff.communities.includes(order.communityId)) {
    return { success: false, reason: '该外勤人员不服务此社区' };
  }

  const previousStaff = order.assignedStaffName;

  order.assignedStaffId = newStaff.staffId;
  order.assignedStaffName = newStaff.name;
  order.assignedStaffPhone = newStaff.phone;
  order.reassignHistory = order.reassignHistory || [];
  order.reassignHistory.push({
    fromStaffId: order.assignedStaffId,
    fromStaffName: previousStaff,
    toStaffId: newStaff.staffId,
    toStaffName: newStaff.name,
    time: new Date().toISOString(),
    operatorId,
    operatorName,
    remark: remark || '改派'
  });
  order.statusHistory.push({
    status: order.status,
    time: new Date().toISOString(),
    operatorId,
    operatorName,
    remark: remark || `改派：从${previousStaff}改为${newStaff.name}`
  });
  order.updatedAt = new Date().toISOString();

  saveOrders(records);
  return { success: true, order };
}

function getOrders(page = 1, pageSize = 20, filters = {}) {
  expireOldOrders();
  let records = loadOrders();

  if (filters.status) {
    records = records.filter(r => r.status === filters.status);
  }
  if (filters.cardType) {
    records = records.filter(r => r.cardType === filters.cardType);
  }
  if (filters.businessType) {
    records = records.filter(r => r.businessType === filters.businessType);
  }
  if (filters.communityId) {
    records = records.filter(r => r.communityId === filters.communityId);
  }
  if (filters.assignedStaffId) {
    records = records.filter(r => r.assignedStaffId === filters.assignedStaffId);
  }
  if (filters.materialRiskLevel) {
    records = records.filter(r => r.materialRiskLevel === filters.materialRiskLevel);
  }
  if (filters.isReviewRequired !== undefined) {
    records = records.filter(r => r.isReviewRequired === (filters.isReviewRequired === true || filters.isReviewRequired === 'true'));
  }
  if (filters.transferredToWindow !== undefined) {
    records = records.filter(r => r.transferredToWindow === (filters.transferredToWindow === true || filters.transferredToWindow === 'true'));
  }
  if (filters.startDate) {
    records = records.filter(r => r.expectedDate >= filters.startDate);
  }
  if (filters.endDate) {
    records = records.filter(r => r.expectedDate <= filters.endDate);
  }
  if (filters.createdStartDate) {
    records = records.filter(r => (r.createdAt || '').split('T')[0] >= filters.createdStartDate);
  }
  if (filters.createdEndDate) {
    records = records.filter(r => (r.createdAt || '').split('T')[0] <= filters.createdEndDate);
  }
  if (filters.cancelReasonCode) {
    records = records.filter(r => r.cancelReasonCode === filters.cancelReasonCode);
  }
  if (filters.idCardKey) {
    records = records.filter(r => r.idCardKey === filters.idCardKey);
  }
  if (filters.mobilityLevel) {
    records = records.filter(r => r.mobilityLevel === filters.mobilityLevel);
  }

  const total = records.length;
  const start = (page - 1) * pageSize;
  const list = records.slice(start, start + pageSize);

  return {
    list,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  };
}

function getOrderById(id) {
  expireOldOrders();
  const records = loadOrders();
  return records.find(r => r.id === id) || null;
}

function getOrdersForStats(filters = {}) {
  expireOldOrders();
  let records = loadOrders();

  if (filters.cardType) records = records.filter(r => r.cardType === filters.cardType);
  if (filters.businessType) records = records.filter(r => r.businessType === filters.businessType);
  if (filters.communityId) records = records.filter(r => r.communityId === filters.communityId);
  if (filters.status) records = records.filter(r => r.status === filters.status);
  if (filters.startDate) records = records.filter(r => r.expectedDate >= filters.startDate);
  if (filters.endDate) records = records.filter(r => r.expectedDate <= filters.endDate);
  if (filters.assignedStaffId) records = records.filter(r => r.assignedStaffId === filters.assignedStaffId);

  return records;
}

function clearAllOrders() {
  saveOrders([]);
  return true;
}

module.exports = {
  evaluateHomeVisit,
  createHomeVisitOrder,
  dispatchOrder,
  startOnSite,
  completeOrder,
  cancelOrder,
  reassignOrder,
  getOrders,
  getOrderById,
  getOrdersForStats,
  clearAllOrders,
  expireOldOrders,
  countStaffDailyLoad,
  countCommunityDailyOrders,
  homeVisitStatus,
  homeVisitStatusNames,
  homeVisitCancelReasons,
  homeVisitFailReasons
};
