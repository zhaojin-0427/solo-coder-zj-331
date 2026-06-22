const fs = require('fs');
const path = require('path');

const { matchRule } = require('./ruleService');
const { canArchiveSuccessful } = require('../utils/validator');
const {
  appointmentStatus,
  appointmentStatusNames,
  failReasons,
  cancelReasons,
  getBusinessTime,
  getSuitableWindows,
  getAllTimeSlots,
  getCommunityWindowConfig,
  getAgentComplexity,
  windowTypes
} = require('../config/windows');
const { communityNames, businessTypeNames, materialNames } = require('../config/rules');
const cardTypes = require('../config/cardTypes');

const DATA_FILE = path.join(__dirname, '../data/appointments.json');

let appointmentsCache = null;

function ensureDataFile() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
  }
}

function loadAppointments() {
  if (appointmentsCache) {
    return appointmentsCache;
  }
  ensureDataFile();
  try {
    const content = fs.readFileSync(DATA_FILE, 'utf-8');
    appointmentsCache = JSON.parse(content);
  } catch (e) {
    appointmentsCache = [];
  }
  return appointmentsCache;
}

function saveAppointments(records) {
  appointmentsCache = records;
  fs.writeFileSync(DATA_FILE, JSON.stringify(records, null, 2));
}

function generateId() {
  return 'APT' + Date.now().toString() + Math.random().toString(36).slice(2, 8).toUpperCase();
}

function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.ceil(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24));
}

function expireOldAppointments() {
  const records = loadAppointments();
  const today = new Date().toISOString().split('T')[0];
  let changed = false;

  for (const rec of records) {
    if ((rec.status === appointmentStatus.PENDING || rec.status === appointmentStatus.CONFIRMED)
        && rec.expectedDate < today) {
      rec.status = appointmentStatus.EXPIRED;
      rec.statusHistory = rec.statusHistory || [];
      rec.statusHistory.push({
        status: appointmentStatus.EXPIRED,
        time: new Date().toISOString(),
        reason: '预约日期已过期'
      });
      changed = true;
    }
  }

  if (changed) {
    saveAppointments(records);
  }
}

function extractIdCardKey(materials) {
  if (!materials || !Array.isArray(materials)) return null;
  const idCard = materials.find(m => m.key === 'id_card');
  if (idCard && idCard.idNumber) return idCard.idNumber;
  if (idCard && idCard.cardNumber) return idCard.cardNumber;
  return null;
}

function checkDuplicateAppointment(params) {
  expireOldAppointments();
  const records = loadAppointments();
  const { cardType, businessType, materials, expectedDate, communityId } = params;

  const idCardKey = extractIdCardKey(materials);

  const activeStatuses = [appointmentStatus.PENDING, appointmentStatus.CONFIRMED];

  for (const rec of records) {
    if (!activeStatuses.includes(rec.status)) continue;

    if (idCardKey && rec.idCardKey && rec.idCardKey === idCardKey) {
      if (rec.cardType === cardType && rec.businessType === businessType) {
        return {
          isDuplicate: true,
          reason: '该老人同一卡证业务存在有效预约',
          existingAppointment: {
            id: rec.id,
            expectedDate: rec.expectedDate,
            expectedTimeSlot: rec.expectedTimeSlot,
            status: rec.status,
            statusName: appointmentStatusNames[rec.status]
          }
        };
      }
    }

    if (rec.expectedDate === expectedDate && rec.communityId === communityId) {
      if (rec.cardType === cardType && rec.businessType === businessType) {
        if (idCardKey && rec.idCardKey && rec.idCardKey === idCardKey) {
          return {
            isDuplicate: true,
            reason: '该老人同一日期同一卡证业务已预约',
            existingAppointment: {
              id: rec.id,
              expectedDate: rec.expectedDate,
              expectedTimeSlot: rec.expectedTimeSlot,
              status: rec.status,
              statusName: appointmentStatusNames[rec.status]
            }
          };
        }
      }
    }
  }

  return { isDuplicate: false };
}

function countWindowLoad(communityId, expectedDate, expectedTimeSlot) {
  expireOldAppointments();
  const records = loadAppointments();
  const activeStatuses = [appointmentStatus.PENDING, appointmentStatus.CONFIRMED];
  const windowLoad = {};

  for (const rec of records) {
    if (!activeStatuses.includes(rec.status)) continue;
    if (rec.communityId !== communityId) continue;
    if (rec.expectedDate !== expectedDate) continue;
    if (expectedTimeSlot && rec.expectedTimeSlot !== expectedTimeSlot) continue;

    if (!windowLoad[rec.assignedWindowId]) {
      windowLoad[rec.assignedWindowId] = 0;
    }
    windowLoad[rec.assignedWindowId] += rec.businessMinutes || 15;
  }

  return windowLoad;
}

function recommendTimeSlots(communityId, expectedDate, preferredPeriod = null, businessMinutes = 15) {
  expireOldAppointments();
  const allSlots = getAllTimeSlots();
  const winConfig = getCommunityWindowConfig(communityId);
  const totalCapacity = winConfig ? winConfig.totalCapacity : 5;

  const scoredSlots = [];

  for (const slotInfo of allSlots) {
    if (preferredPeriod && slotInfo.period !== preferredPeriod && preferredPeriod !== 'any') {
      continue;
    }

    const windowLoad = countWindowLoad(communityId, expectedDate, slotInfo.slot);
    const totalLoadMinutes = Object.values(windowLoad).reduce((a, b) => a + b, 0);
    const totalCapacityMinutes = totalCapacity * 30;
    const loadRatio = totalCapacityMinutes > 0 ? totalLoadMinutes / totalCapacityMinutes : 0;

    let available = true;
    let waitMinutes = Math.round(totalLoadMinutes / Math.max(totalCapacity, 1));

    if (loadRatio >= 0.95) {
      available = false;
    }

    const periodBonus = preferredPeriod && slotInfo.period === preferredPeriod ? 20 : 0;
    const loadScore = Math.max(0, 100 - loadRatio * 100);
    const middayPreference = (slotInfo.startTime === '10:00' || slotInfo.startTime === '14:30') ? 10 : 0;

    scoredSlots.push({
      ...slotInfo,
      available,
      loadRatio: Number((loadRatio * 100).toFixed(1)),
      totalLoadMinutes,
      estimatedWaitMinutes: waitMinutes,
      score: loadScore + periodBonus + middayPreference
    });
  }

  scoredSlots.sort((a, b) => b.score - a.score);

  const availableSlots = scoredSlots.filter(s => s.available);
  const bestSlot = availableSlots.length > 0 ? availableSlots[0] : (scoredSlots[0] || null);

  return {
    recommendedSlot: bestSlot,
    allSlots: scoredSlots,
    availableCount: availableSlots.length,
    totalCount: scoredSlots.length
  };
}

function predictAppointment(params) {
  const {
    cardType,
    businessType,
    age,
    isPresent,
    agentRelation,
    materials,
    materialKeys,
    communityId,
    expectedDate,
    preferredTimeSlot = 'any'
  } = params;

  const result = {
    canReserve: false,
    rulePassed: false,
    ruleCheckResult: null,
    reasons: [],
    recommendedWindow: null,
    alternativeWindows: [],
    recommendedTimeSlot: null,
    alternativeTimeSlots: [],
    estimatedWaitMinutes: 0,
    businessMinutes: 0,
    diversionSuggestions: [],
    cannotReserveReasons: [],
    supplementaryMaterials: [],
    specialReminders: [],
    isReviewRequired: false,
    isAgent: !isPresent,
    agentComplexity: null
  };

  const ruleResult = matchRule(cardType, businessType, {
    age,
    isPresent,
    agentRelation,
    materialKeys,
    materials,
    communityId,
    handleDate: expectedDate
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
  result.specialReminders = ruleResult.specialReminders || [];

  if (!isPresent && agentRelation) {
    result.agentComplexity = getAgentComplexity(agentRelation);
  }

  result.businessMinutes = getBusinessTime(
    cardType,
    businessType,
    !isPresent,
    result.isReviewRequired,
    agentRelation
  );

  if (!ruleResult.canProceed) {
    result.cannotReserveReasons = [...(ruleResult.errors || [])];
    result.supplementaryMaterials = [
      ...(ruleResult.missingMaterials || []).map(m => ({
        ...m,
        hint: `请补充：${m.name}`
      })),
      ...(ruleResult.expiredMaterials || []).map(m => ({
        ...m,
        isExpired: true,
        hint: `请更新：${m.name}（已过期）`
      }))
    ];
    return result;
  }

  if (ruleResult.missingMaterials && ruleResult.missingMaterials.length > 0) {
    result.cannotReserveReasons.push('存在缺失材料');
    result.supplementaryMaterials = ruleResult.missingMaterials.map(m => ({
      ...m,
      hint: `请补充：${m.name}`
    }));
  }

  if (ruleResult.expiredMaterials && ruleResult.expiredMaterials.length > 0) {
    result.cannotReserveReasons.push('存在过期材料');
    result.supplementaryMaterials.push(
      ...ruleResult.expiredMaterials.map(m => ({
        ...m,
        isExpired: true,
        hint: `请更新：${m.name}（已过期）`
      }))
    );
  }

  if (result.supplementaryMaterials.length > 0) {
    return result;
  }

  const suitableWindows = getSuitableWindows(
    communityId,
    cardType,
    businessType,
    !isPresent,
    result.isReviewRequired,
    age
  );

  if (suitableWindows.length === 0) {
    result.cannotReserveReasons.push('当前社区无可办理该业务的窗口');
    result.diversionSuggestions.push(`建议前往${communityNames[communityId] || '附近社区'}服务中心咨询`);
    const allCommunities = Object.keys(communityNames).filter(c => c !== 'all' && c !== communityId);
    for (const cid of allCommunities.slice(0, 3)) {
      const cWin = getSuitableWindows(cid, cardType, businessType, !isPresent, result.isReviewRequired, age);
      if (cWin.length > 0) {
        result.diversionSuggestions.push(`可分流至${communityNames[cid]}办理，该社区有${cWin.length}个适配窗口`);
      }
    }
    return result;
  }

  const today = new Date().toISOString().split('T')[0];
  if (expectedDate < today) {
    result.cannotReserveReasons.push('预约日期不能早于今日');
    return result;
  }
  if (daysBetween(today, expectedDate) > 30) {
    result.cannotReserveReasons.push('预约日期不能超过30天');
    return result;
  }

  const windowLoad = countWindowLoad(communityId, expectedDate);

  const scoredWindows = suitableWindows.map(win => {
    const load = windowLoad[win.windowId] || 0;
    const loadRatio = load / (win.capacity * 30 * 6);
    const finalScore = win.priorityScore - loadRatio * 50;
    return {
      ...win,
      currentLoadMinutes: load,
      loadRatio: Number((loadRatio * 100).toFixed(1)),
      finalScore,
      estimatedQueueCount: Math.ceil(load / result.businessMinutes)
    };
  }).sort((a, b) => b.finalScore - a.finalScore);

  result.recommendedWindow = scoredWindows[0] || null;
  result.alternativeWindows = scoredWindows.slice(1, 4);

  const allSlots = getAllTimeSlots();
  const isExactSlot = typeof preferredTimeSlot === 'string'
    && preferredTimeSlot.includes('-')
    && preferredTimeSlot !== 'morning'
    && preferredTimeSlot !== 'afternoon'
    && preferredTimeSlot !== 'any';

  let preferredPeriod = 'any';
  if (preferredTimeSlot === 'morning') preferredPeriod = 'morning';
  else if (preferredTimeSlot === 'afternoon') preferredPeriod = 'afternoon';
  else if (isExactSlot) {
    const hour = parseInt(preferredTimeSlot.split('-')[0]);
    preferredPeriod = hour < 12 ? 'morning' : 'afternoon';
  }

  const slotRecommendation = recommendTimeSlots(
    communityId,
    expectedDate,
    preferredPeriod,
    result.businessMinutes
  );

  if (isExactSlot) {
    const exactSlot = slotRecommendation.allSlots.find(s => s.slot === preferredTimeSlot);
    if (exactSlot) {
      if (exactSlot.available) {
        result.recommendedTimeSlot = exactSlot;
        result.isExactSlotSelected = true;
      } else {
        result.cannotReserveReasons.push(`所选时段 ${preferredTimeSlot} 已满，不可预约`);
        result.diversionSuggestions.push(`所选时段 ${preferredTimeSlot} 负载已满，请选择以下推荐时段`);
        result.recommendedTimeSlot = slotRecommendation.recommendedSlot;
        result.alternativeTimeSlots = slotRecommendation.allSlots
          .filter(s => s.available && s !== slotRecommendation.recommendedSlot)
          .slice(0, 4);
        result.canReserve = false;
        result.exactSlotUnavailable = true;
      }
    } else {
      result.cannotReserveReasons.push(`无效的预约时段：${preferredTimeSlot}`);
      result.recommendedTimeSlot = slotRecommendation.recommendedSlot;
      result.alternativeTimeSlots = slotRecommendation.allSlots
        .filter(s => s.available && s !== slotRecommendation.recommendedSlot)
        .slice(0, 4);
      result.canReserve = false;
    }
  } else {
    result.recommendedTimeSlot = slotRecommendation.recommendedSlot;
    result.alternativeTimeSlots = slotRecommendation.allSlots
      .filter(s => s.available && s !== slotRecommendation.recommendedSlot)
      .slice(0, 4);
  }

  if (result.recommendedTimeSlot) {
    result.estimatedWaitMinutes = result.recommendedTimeSlot.estimatedWaitMinutes;
  }

  if (scoredWindows.length > 0 && result.recommendedTimeSlot && result.recommendedTimeSlot.loadRatio > 70) {
    result.diversionSuggestions.push('当前时段窗口负载较高，建议优先选择推荐时段');
  }

  if (result.isReviewRequired) {
    result.diversionSuggestions.push('高龄复核业务建议预留充足时间，复核过程可能需要额外10-15分钟');
  }

  if (!isPresent && result.agentComplexity && result.agentComplexity.level !== 'low') {
    result.diversionSuggestions.push(`代办关系为${result.agentComplexity.name}，建议提前准备好完整代办材料`);
  }

  if (suitableWindows.length > 1) {
    result.diversionSuggestions.push(`该业务可在${suitableWindows.length}种类型窗口办理，推荐优先选择${result.recommendedWindow?.typeName || '综合窗口'}`);
  }

  result.canReserve = true;
  return result;
}

function determineFailReason(prediction, params) {
  const failReasonList = [];
  const ruleCheck = prediction.ruleCheckResult;

  if (ruleCheck && !ruleCheck.canProceed) {
    if (ruleCheck.errors && ruleCheck.errors.length > 0) {
      failReasonList.push('rule_not_passed');
    }
    if (ruleCheck.missingMaterials && ruleCheck.missingMaterials.length > 0) {
      failReasonList.push('material_missing');
    }
    if (ruleCheck.expiredMaterials && ruleCheck.expiredMaterials.length > 0) {
      failReasonList.push('material_expired');
    }
    if (ruleCheck.ageNotMet) {
      failReasonList.push('age_not_met');
    }
    if (ruleCheck.presenceRequired) {
      failReasonList.push('presence_required');
    }
    if (ruleCheck.agentInvalid) {
      failReasonList.push('agent_invalid');
    }
  }

  if (prediction.cannotReserveReasons) {
    for (const reason of prediction.cannotReserveReasons) {
      if (reason.includes('无') && reason.includes('窗口')) failReasonList.push('no_available_window');
      if (reason.includes('日期')) failReasonList.push('date_invalid');
    }
  }

  if (failReasonList.length === 0) {
    failReasonList.push('other');
  }

  return failReasonList;
}

function createFailedAppointment(params, prediction, failReasonsList, duplicateCheck = null) {
  const {
    cardType,
    businessType,
    age,
    isPresent,
    agentRelation,
    materials,
    materialKeys,
    communityId,
    expectedDate,
    preferredTimeSlot = 'any',
    operatorId = 'system',
    operatorName = '系统',
    applicantName = null,
    applicantContact = null,
    remarks = null
  } = params;

  const materialsList = materials || [];
  const keysList = materialKeys || materialsList.map(m => m.key);
  const idCardKey = extractIdCardKey(materialsList);

  const records = loadAppointments();
  const primaryReason = failReasonsList[0] || 'other';

  const appointment = {
    id: generateId(),
    cardType,
    cardName: cardTypes[cardType]?.name || cardType,
    businessType,
    businessName: businessTypeNames[businessType] || businessType,
    age,
    isPresent: !!isPresent,
    isAgent: !isPresent,
    agentRelation: agentRelation || null,
    agentRelationName: agentRelation ? (require('../config/rules').agentRelationNames[agentRelation] || agentRelation) : null,
    agentComplexity: prediction.agentComplexity,
    communityId,
    communityName: communityNames[communityId] || communityId,
    expectedDate,
    expectedTimeSlot: prediction.recommendedTimeSlot?.slot || (typeof preferredTimeSlot === 'string' && preferredTimeSlot.includes('-') ? preferredTimeSlot : null),
    expectedTimePeriod: prediction.recommendedTimeSlot?.period || null,
    assignedWindowId: prediction.recommendedWindow?.windowId || null,
    assignedWindowType: prediction.recommendedWindow?.type || null,
    assignedWindowTypeName: prediction.recommendedWindow?.typeName || null,
    alternativeWindows: prediction.alternativeWindows,
    alternativeTimeSlots: prediction.alternativeTimeSlots,
    businessMinutes: prediction.businessMinutes,
    estimatedWaitMinutes: prediction.estimatedWaitMinutes,
    estimatedTotalMinutes: (prediction.businessMinutes || 0) + (prediction.estimatedWaitMinutes || 0),
    isReviewRequired: prediction.isReviewRequired,
    materials: materialsList,
    materialKeys: keysList,
    idCardKey,
    applicantName,
    applicantContact,
    ruleVersion: prediction.ruleCheckResult?.ruleVersion,
    status: appointmentStatus.FAILED,
    statusName: appointmentStatusNames[appointmentStatus.FAILED],
    statusHistory: [
      {
        status: appointmentStatus.FAILED,
        time: new Date().toISOString(),
        operatorId,
        operatorName,
        remark: duplicateCheck ? '重复预约被拦截' : '预约失败：' + (prediction.cannotReserveReasons?.[0] || '不符合预约条件')
      }
    ],
    failReasonCodes: failReasonsList,
    failReasons: failReasonsList.map(r => failReasons[r] || r),
    cannotReserveReasons: prediction.cannotReserveReasons,
    supplementaryMaterials: prediction.supplementaryMaterials,
    isDuplicate: !!duplicateCheck,
    duplicateCheck,
    cancelReason: null,
    cancelReasonCode: null,
    cancelRemark: null,
    cancelledBy: null,
    cancelledAt: null,
    confirmedAt: null,
    confirmedBy: null,
    operatorId,
    operatorName,
    remarks,
    predictionSnapshot: {
      recommendedWindow: prediction.recommendedWindow,
      recommendedTimeSlot: prediction.recommendedTimeSlot,
      diversionSuggestions: prediction.diversionSuggestions,
      specialReminders: prediction.specialReminders,
      ruleCheckResult: prediction.ruleCheckResult
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  records.unshift(appointment);
  saveAppointments(records);
  return appointment;
}

function createAppointment(params) {
  expireOldAppointments();

  const {
    cardType,
    businessType,
    age,
    isPresent,
    agentRelation,
    materials,
    materialKeys,
    communityId,
    expectedDate,
    preferredTimeSlot = 'any',
    operatorId = 'system',
    operatorName = '系统',
    applicantName = null,
    applicantContact = null,
    remarks = null
  } = params;

  const materialsList = materials || [];
  const keysList = materialKeys || materialsList.map(m => m.key);
  const idCardKey = extractIdCardKey(materialsList);

  const predictParams = {
    cardType,
    businessType,
    age,
    isPresent,
    agentRelation,
    materials: materialsList,
    materialKeys: keysList,
    communityId,
    expectedDate,
    preferredTimeSlot
  };

  const prediction = predictAppointment(predictParams);

  if (!prediction.canReserve) {
    const failReasonsList = determineFailReason(prediction, params);
    const failedAppointment = createFailedAppointment(params, prediction, failReasonsList);
    return {
      success: false,
      reason: prediction.cannotReserveReasons.length > 0 ? prediction.cannotReserveReasons[0] : '不符合预约条件',
      cannotReserveReasons: prediction.cannotReserveReasons,
      supplementaryMaterials: prediction.supplementaryMaterials,
      failReasonCodes: failReasonsList,
      failReasons: failReasonsList.map(r => failReasons[r] || r),
      appointment: failedAppointment,
      prediction
    };
  }

  const duplicateCheck = checkDuplicateAppointment({
    cardType,
    businessType,
    materials: materialsList,
    expectedDate,
    communityId
  });

  if (duplicateCheck.isDuplicate) {
    const failReasonsList = ['duplicate'];
    const failedAppointment = createFailedAppointment(params, prediction, failReasonsList, duplicateCheck);
    return {
      success: false,
      reason: duplicateCheck.reason,
      failReasonCodes: failReasonsList,
      failReasons: failReasonsList.map(r => failReasons[r] || r),
      appointment: failedAppointment,
      duplicateCheck,
      prediction
    };
  }

  const records = loadAppointments();

  const appointment = {
    id: generateId(),
    cardType,
    cardName: cardTypes[cardType]?.name || cardType,
    businessType,
    businessName: businessTypeNames[businessType] || businessType,
    age,
    isPresent: !!isPresent,
    isAgent: !isPresent,
    agentRelation: agentRelation || null,
    agentRelationName: agentRelation ? (require('../config/rules').agentRelationNames[agentRelation] || agentRelation) : null,
    agentComplexity: prediction.agentComplexity,
    communityId,
    communityName: communityNames[communityId] || communityId,
    expectedDate,
    expectedTimeSlot: prediction.recommendedTimeSlot?.slot || null,
    expectedTimePeriod: prediction.recommendedTimeSlot?.period || null,
    assignedWindowId: prediction.recommendedWindow?.windowId || null,
    assignedWindowType: prediction.recommendedWindow?.type || null,
    assignedWindowTypeName: prediction.recommendedWindow?.typeName || null,
    alternativeWindows: prediction.alternativeWindows,
    alternativeTimeSlots: prediction.alternativeTimeSlots,
    businessMinutes: prediction.businessMinutes,
    estimatedWaitMinutes: prediction.estimatedWaitMinutes,
    estimatedTotalMinutes: prediction.businessMinutes + prediction.estimatedWaitMinutes,
    isReviewRequired: prediction.isReviewRequired,
    materials: materialsList,
    materialKeys: keysList,
    idCardKey,
    applicantName,
    applicantContact,
    ruleVersion: prediction.ruleCheckResult?.ruleVersion,
    status: appointmentStatus.PENDING,
    statusName: appointmentStatusNames[appointmentStatus.PENDING],
    statusHistory: [
      {
        status: appointmentStatus.PENDING,
        time: new Date().toISOString(),
        operatorId,
        operatorName,
        remark: '创建预约'
      }
    ],
    cancelReason: null,
    cancelReasonCode: null,
    cancelRemark: null,
    cancelledBy: null,
    cancelledAt: null,
    confirmedAt: null,
    confirmedBy: null,
    operatorId,
    operatorName,
    remarks,
    predictionSnapshot: {
      recommendedWindow: prediction.recommendedWindow,
      recommendedTimeSlot: prediction.recommendedTimeSlot,
      diversionSuggestions: prediction.diversionSuggestions,
      specialReminders: prediction.specialReminders
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  records.unshift(appointment);
  saveAppointments(records);

  return {
    success: true,
    appointment,
    prediction
  };
}

function confirmAppointment(id, operatorId = 'system', operatorName = '系统', remark = null) {
  expireOldAppointments();
  const records = loadAppointments();
  const apt = records.find(r => r.id === id);

  if (!apt) {
    return { success: false, reason: '预约记录不存在' };
  }

  if (apt.status !== appointmentStatus.PENDING) {
    return {
      success: false,
      reason: `当前状态为${appointmentStatusNames[apt.status]}，不可确认`,
      currentStatus: apt.status
    };
  }

  apt.status = appointmentStatus.CONFIRMED;
  apt.statusName = appointmentStatusNames[appointmentStatus.CONFIRMED];
  apt.confirmedAt = new Date().toISOString();
  apt.confirmedBy = { operatorId, operatorName };
  apt.statusHistory.push({
    status: appointmentStatus.CONFIRMED,
    time: new Date().toISOString(),
    operatorId,
    operatorName,
    remark: remark || '确认预约'
  });
  apt.updatedAt = new Date().toISOString();

  saveAppointments(records);
  return { success: true, appointment: apt };
}

function cancelAppointment(id, reasonCode = 'other', reason = null, remark = null, operatorId = 'system', operatorName = '系统') {
  expireOldAppointments();
  const records = loadAppointments();
  const apt = records.find(r => r.id === id);

  if (!apt) {
    return { success: false, reason: '预约记录不存在' };
  }

  const terminalStatuses = [appointmentStatus.CANCELLED, appointmentStatus.EXPIRED];
  if (terminalStatuses.includes(apt.status)) {
    return {
      success: false,
      reason: `当前状态为${appointmentStatusNames[apt.status]}，不可重复取消`,
      currentStatus: apt.status
    };
  }

  apt.status = appointmentStatus.CANCELLED;
  apt.statusName = appointmentStatusNames[appointmentStatus.CANCELLED];
  apt.cancelReasonCode = reasonCode;
  apt.cancelReason = reason || cancelReasons[reasonCode] || '其他原因';
  apt.cancelRemark = remark;
  apt.cancelledAt = new Date().toISOString();
  apt.cancelledBy = { operatorId, operatorName };
  apt.statusHistory.push({
    status: appointmentStatus.CANCELLED,
    time: new Date().toISOString(),
    operatorId,
    operatorName,
    reasonCode,
    reason: apt.cancelReason,
    remark
  });
  apt.updatedAt = new Date().toISOString();

  saveAppointments(records);
  return { success: true, appointment: apt };
}

function getAppointments(page = 1, pageSize = 20, filters = {}) {
  expireOldAppointments();
  let records = loadAppointments();

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
  if (filters.isAgent !== undefined) {
    records = records.filter(r => r.isAgent === (filters.isAgent === true || filters.isAgent === 'true'));
  }
  if (filters.isReviewRequired !== undefined) {
    records = records.filter(r => r.isReviewRequired === (filters.isReviewRequired === true || filters.isReviewRequired === 'true'));
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
  if (filters.assignedWindowId) {
    records = records.filter(r => r.assignedWindowId === filters.assignedWindowId);
  }
  if (filters.idCardKey) {
    records = records.filter(r => r.idCardKey === filters.idCardKey);
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

function getAppointmentById(id) {
  expireOldAppointments();
  const records = loadAppointments();
  return records.find(r => r.id === id) || null;
}

function clearAllAppointments() {
  saveAppointments([]);
  return true;
}

function getAppointmentsForStats(filters = {}) {
  expireOldAppointments();
  let records = loadAppointments();

  if (filters.cardType) records = records.filter(r => r.cardType === filters.cardType);
  if (filters.businessType) records = records.filter(r => r.businessType === filters.businessType);
  if (filters.communityId) records = records.filter(r => r.communityId === filters.communityId);
  if (filters.status) records = records.filter(r => r.status === filters.status);
  if (filters.startDate) records = records.filter(r => r.expectedDate >= filters.startDate);
  if (filters.endDate) records = records.filter(r => r.expectedDate <= filters.endDate);
  if (filters.isAgent !== undefined) {
    const isAgent = filters.isAgent === true || filters.isAgent === 'true';
    records = records.filter(r => r.isAgent === isAgent);
  }

  return records;
}

function getWindowStatus(communityId, expectedDate = new Date().toISOString().split('T')[0]) {
  expireOldAppointments();
  const config = getCommunityWindowConfig(communityId);
  if (!config) return null;

  const windowLoad = countWindowLoad(communityId, expectedDate);
  const allSlots = getAllTimeSlots();
  const results = [];

  for (const win of config.windows) {
    const load = windowLoad[win.windowId] || 0;
    const capacityMinutes = win.capacity * 30 * allSlots.length;
    const typeConfig = windowTypes[win.type];

    results.push({
      windowId: win.windowId,
      type: win.type,
      typeName: typeConfig?.name || win.type,
      capacity: win.capacity,
      loadMinutes: load,
      capacityMinutes,
      loadRatio: capacityMinutes > 0 ? Number(((load / capacityMinutes) * 100).toFixed(1)) : 0,
      status: load >= capacityMinutes ? 'full' : (load >= capacityMinutes * 0.8 ? 'busy' : 'normal')
    });
  }

  return {
    communityId,
    communityName: config.communityName,
    expectedDate,
    windows: results,
    totalCapacity: config.totalCapacity
  };
}

module.exports = {
  predictAppointment,
  createAppointment,
  confirmAppointment,
  cancelAppointment,
  getAppointments,
  getAppointmentById,
  clearAllAppointments,
  getAppointmentsForStats,
  getWindowStatus,
  expireOldAppointments,
  checkDuplicateAppointment,
  countWindowLoad,
  recommendTimeSlots,
  getSuitableWindows,
  appointmentStatus,
  appointmentStatusNames,
  cancelReasons
};
