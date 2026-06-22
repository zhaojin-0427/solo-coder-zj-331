const express = require('express');
const router = express.Router();
const { success, fail } = require('../utils/response');
const {
  validateHomeVisitSubmission,
  validateHomeVisitCancel,
  validateHomeVisitDispatch,
  validateHomeVisitReassign,
  validateHomeVisitComplete
} = require('../utils/validator');
const {
  evaluateHomeVisit,
  createHomeVisitOrder,
  dispatchOrder,
  startOnSite,
  completeOrder,
  cancelOrder,
  reassignOrder,
  getOrders,
  getOrderById,
  clearAllOrders,
  homeVisitStatus,
  homeVisitStatusNames,
  homeVisitCancelReasons,
  homeVisitFailReasons
} = require('../services/homeVisitService');
const {
  getCommunityHomeVisitStats,
  getStaffLoadRanking,
  getAverageHomeVisitTimeStats,
  getCannotDispatchReasonRanking,
  getSeniorReviewHomeVisitRatio,
  getMaterialCompletionSuccessRate,
  getWindowTransferDistribution,
  getHomeVisitOverview
} = require('../services/homeVisitStatsService');
const {
  mobilityLevels,
  materialRiskLevels,
  fieldStaff,
  homeServiceScopes,
  homeVisitTimeSlots,
  homeVisitTimeSlotNames,
  getAllHomeVisitTimeSlots,
  getFieldStaffByCommunity,
  getServiceScope
} = require('../config/homeVisit');
const { communityNames } = require('../config/rules');

function parseHomeVisitFilters(req) {
  const filters = {};
  if (req.query.status) filters.status = req.query.status;
  if (req.query.cardType) filters.cardType = req.query.cardType;
  if (req.query.businessType) filters.businessType = req.query.businessType;
  if (req.query.communityId) filters.communityId = req.query.communityId;
  if (req.query.assignedStaffId) filters.assignedStaffId = req.query.assignedStaffId;
  if (req.query.materialRiskLevel) filters.materialRiskLevel = req.query.materialRiskLevel;
  if (req.query.isReviewRequired !== undefined) filters.isReviewRequired = req.query.isReviewRequired;
  if (req.query.transferredToWindow !== undefined) filters.transferredToWindow = req.query.transferredToWindow;
  if (req.query.startDate) filters.startDate = req.query.startDate;
  if (req.query.endDate) filters.endDate = req.query.endDate;
  if (req.query.createdStartDate) filters.createdStartDate = req.query.createdStartDate;
  if (req.query.createdEndDate) filters.createdEndDate = req.query.createdEndDate;
  if (req.query.cancelReasonCode) filters.cancelReasonCode = req.query.cancelReasonCode;
  if (req.query.idCardKey) filters.idCardKey = req.query.idCardKey;
  if (req.query.mobilityLevel) filters.mobilityLevel = req.query.mobilityLevel;
  return filters;
}

router.post('/evaluate', (req, res) => {
  const validation = validateHomeVisitSubmission(req.body);

  if (!validation.valid) {
    return res.json(fail(400, '参数校验失败', { errors: validation.errors }));
  }

  const { normalized } = validation;
  const evaluation = evaluateHomeVisit(normalized);

  res.json(success({
    canDispatch: evaluation.canDispatch,
    rulePassed: evaluation.rulePassed,
    ruleCheckResult: evaluation.ruleCheckResult,
    recommendedStaff: evaluation.recommendedStaff,
    alternativeStaff: evaluation.alternativeStaff,
    recommendedTimeSlot: evaluation.recommendedTimeSlot,
    alternativeTimeSlots: evaluation.alternativeTimeSlots,
    estimatedServiceMinutes: evaluation.estimatedServiceMinutes,
    estimatedTotalMinutes: evaluation.estimatedTotalMinutes,
    cannotDispatchReasons: evaluation.cannotDispatchReasons,
    supplementaryMaterials: evaluation.supplementaryMaterials,
    riskTips: evaluation.riskTips,
    windowSuggestions: evaluation.windowSuggestions,
    isReviewRequired: evaluation.isReviewRequired,
    needsDualVerify: evaluation.needsDualVerify,
    needsReviewerCompanion: evaluation.needsReviewerCompanion,
    materialRiskLevel: evaluation.materialRiskLevel,
    serviceScopeCheck: evaluation.serviceScopeCheck
  }, evaluation.canDispatch ? '上门评估通过，可发起派单' : '上门评估未通过'));
});

router.post('/create', (req, res) => {
  const validation = validateHomeVisitSubmission(req.body);

  if (!validation.valid) {
    return res.json(fail(400, '参数校验失败', { errors: validation.errors }));
  }

  const { normalized } = validation;
  const result = createHomeVisitOrder(normalized);

  if (!result.success) {
    return res.json(fail(400, result.order?.cancelReason || '工单创建失败', {
      cannotDispatchReasons: result.order?.cannotDispatchReasons,
      supplementaryMaterials: result.order?.supplementaryMaterials,
      failReasonCodes: result.order?.failReasonCodes,
      failReasons: result.order?.failReasons,
      order: result.order,
      evaluation: result.evaluation
    }));
  }

  res.json(success({
    order: result.order,
    evaluation: result.evaluation
  }, '上门工单创建成功'));
});

router.post('/dispatch/:id', (req, res) => {
  const { id } = req.params;
  const validation = validateHomeVisitDispatch(req.body || {});

  if (!validation.valid) {
    return res.json(fail(400, '参数校验失败', { errors: validation.errors }));
  }

  const { staffId, operatorId, operatorName, remark } = validation.normalized;
  const result = dispatchOrder(
    id,
    staffId,
    operatorId || 'system',
    operatorName || '系统',
    remark
  );

  if (!result.success) {
    return res.json(fail(400, result.reason || '派单失败', {
      currentStatus: result.currentStatus
    }));
  }

  res.json(success({ order: result.order }, '派单成功'));
});

router.post('/start/:id', (req, res) => {
  const { id } = req.params;
  const { operatorId, operatorName, remark } = req.body || {};

  const result = startOnSite(
    id,
    operatorId || 'system',
    operatorName || '系统',
    remark
  );

  if (!result.success) {
    return res.json(fail(400, result.reason || '开始上门失败', {
      currentStatus: result.currentStatus
    }));
  }

  res.json(success({ order: result.order }, '已开始上门服务'));
});

router.post('/complete/:id', (req, res) => {
  const { id } = req.params;
  const validation = validateHomeVisitComplete(req.body || {});

  if (!validation.valid) {
    return res.json(fail(400, '参数校验失败', { errors: validation.errors }));
  }

  const result = completeOrder(id, validation.normalized, validation.normalized.operatorId || 'system', validation.normalized.operatorName || '系统');

  if (!result.success) {
    return res.json(fail(400, result.reason || '完成回执失败', {
      currentStatus: result.currentStatus
    }));
  }

  res.json(success({ order: result.order }, '上门工单完成'));
});

router.post('/cancel/:id', (req, res) => {
  const { id } = req.params;
  const validation = validateHomeVisitCancel(req.body || {});

  if (!validation.valid) {
    return res.json(fail(400, '参数校验失败', { errors: validation.errors }));
  }

  const { reasonCode, reason, remark, operatorId, operatorName } = validation.normalized;
  const result = cancelOrder(
    id,
    reasonCode,
    reason,
    remark,
    operatorId || 'system',
    operatorName || '系统'
  );

  if (!result.success) {
    return res.json(fail(400, result.reason || '取消失败', {
      currentStatus: result.currentStatus
    }));
  }

  res.json(success({ order: result.order }, '工单取消成功'));
});

router.post('/reassign/:id', (req, res) => {
  const { id } = req.params;
  const validation = validateHomeVisitReassign(req.body || {});

  if (!validation.valid) {
    return res.json(fail(400, '参数校验失败', { errors: validation.errors }));
  }

  const { newStaffId, operatorId, operatorName, remark } = validation.normalized;
  const result = reassignOrder(
    id,
    newStaffId,
    operatorId || 'system',
    operatorName || '系统',
    remark
  );

  if (!result.success) {
    return res.json(fail(400, result.reason || '改派失败', {
      currentStatus: result.currentStatus
    }));
  }

  res.json(success({ order: result.order }, '工单改派成功'));
});

router.get('/', (req, res) => {
  const page = Number(req.query.page) || 1;
  const pageSize = Number(req.query.pageSize) || 20;
  const filters = parseHomeVisitFilters(req);

  const result = getOrders(page, pageSize, filters);
  res.json(success(result));
});

router.get('/:id', (req, res) => {
  const order = getOrderById(req.params.id);
  if (!order) {
    return res.json(fail(404, '工单不存在'));
  }
  res.json(success(order));
});

router.delete('/', (req, res) => {
  clearAllOrders();
  res.json(success(null, '已清空所有上门工单'));
});

router.get('/config/statuses', (req, res) => {
  const list = Object.entries(homeVisitStatusNames).map(([key, name]) => ({
    status: key,
    name,
    code: homeVisitStatus[key.toUpperCase()] || key
  }));
  res.json(success({ list, total: list.length }));
});

router.get('/config/mobility-levels', (req, res) => {
  const list = Object.values(mobilityLevels).map(level => ({
    level: level.level,
    name: level.name,
    description: level.description,
    score: level.score
  }));
  res.json(success({ list, total: list.length }));
});

router.get('/config/risk-levels', (req, res) => {
  const list = Object.values(materialRiskLevels).map(level => ({
    level: level.level,
    name: level.name,
    description: level.description,
    score: level.score,
    needsDualVerify: level.needsDualVerify,
    needsReviewer: level.needsReviewer
  }));
  res.json(success({ list, total: list.length }));
});

router.get('/config/cancel-reasons', (req, res) => {
  const list = Object.entries(homeVisitCancelReasons).map(([code, name]) => ({ code, name }));
  res.json(success({ list, total: list.length }));
});

router.get('/config/fail-reasons', (req, res) => {
  const list = Object.entries(homeVisitFailReasons).map(([code, name]) => ({ code, name }));
  res.json(success({ list, total: list.length }));
});

router.get('/config/time-slots', (req, res) => {
  const slots = getAllHomeVisitTimeSlots();
  const periods = Object.entries(homeVisitTimeSlots).map(([key, val]) => ({
    id: key,
    name: val.name,
    startTime: val.startTime,
    endTime: val.endTime,
    slotMinutes: val.slotMinutes,
    slots: val.slots
  }));
  res.json(success({
    periods,
    timeSlotNames: homeVisitTimeSlotNames,
    allSlots: slots,
    totalPeriods: periods.length,
    totalSlots: slots.length
  }));
});

router.get('/config/staff', (req, res) => {
  const communityId = req.query.communityId;
  let staffList = fieldStaff.filter(s => s.status === 'active');
  if (communityId) {
    staffList = getFieldStaffByCommunity(communityId);
  }
  const list = staffList.map(staff => ({
    staffId: staff.staffId,
    name: staff.name,
    phone: staff.phone,
    communities: staff.communities,
    communityNames: staff.communities.map(c => communityNames[c] || c),
    skills: staff.skills,
    businessTypes: staff.businessTypes,
    canReview: staff.canReview,
    workDays: staff.workDays,
    dailyCapacity: staff.dailyCapacity
  }));
  res.json(success({ list, total: list.length }));
});

router.get('/config/service-scope/:communityId', (req, res) => {
  const { communityId } = req.params;
  const scope = getServiceScope(communityId);
  if (!scope) {
    return res.json(fail(404, '未找到该社区上门服务范围'));
  }
  res.json(success(scope));
});

router.get('/stats/overview', (req, res) => {
  const filters = parseHomeVisitFilters(req);
  const data = getHomeVisitOverview(filters);
  res.json(success(data));
});

router.get('/stats/communities', (req, res) => {
  const filters = parseHomeVisitFilters(req);
  const data = getCommunityHomeVisitStats(filters);
  res.json(success(data));
});

router.get('/stats/staff-load', (req, res) => {
  const filters = parseHomeVisitFilters(req);
  const data = getStaffLoadRanking(filters);
  res.json(success(data));
});

router.get('/stats/average-time', (req, res) => {
  const filters = parseHomeVisitFilters(req);
  const data = getAverageHomeVisitTimeStats(filters);
  res.json(success(data));
});

router.get('/stats/cannot-dispatch-reasons', (req, res) => {
  const filters = parseHomeVisitFilters(req);
  const data = getCannotDispatchReasonRanking(filters);
  res.json(success(data));
});

router.get('/stats/review-ratio', (req, res) => {
  const filters = parseHomeVisitFilters(req);
  const data = getSeniorReviewHomeVisitRatio(filters);
  res.json(success(data));
});

router.get('/stats/material-success-rate', (req, res) => {
  const filters = parseHomeVisitFilters(req);
  const data = getMaterialCompletionSuccessRate(filters);
  res.json(success(data));
});

router.get('/stats/window-transfer', (req, res) => {
  const filters = parseHomeVisitFilters(req);
  const data = getWindowTransferDistribution(filters);
  res.json(success(data));
});

module.exports = router;
