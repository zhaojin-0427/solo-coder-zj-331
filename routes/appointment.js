const express = require('express');
const router = express.Router();
const { success, fail } = require('../utils/response');
const {
  validateAppointmentSubmission,
  validateAppointmentCancel
} = require('../utils/validator');
const {
  predictAppointment,
  createAppointment,
  confirmAppointment,
  cancelAppointment,
  getAppointments,
  getAppointmentById,
  clearAllAppointments,
  getWindowStatus,
  appointmentStatus,
  appointmentStatusNames,
  cancelReasons
} = require('../services/appointmentService');
const {
  getCommunityAppointmentStats,
  getWindowLoadRanking,
  getAverageWaitTimeStats,
  getCannotReserveReasonRanking,
  getReviewAppointmentRatio,
  getAgentAppointmentSuccessRate,
  getAppointmentOverview
} = require('../services/appointmentStatsService');
const {
  windowTypes,
  timeSlots,
  timeSlotNames,
  getBusinessTime,
  getCommunityWindowConfig,
  getAllTimeSlots
} = require('../config/windows');

function parseAppointmentFilters(req) {
  const filters = {};
  if (req.query.status) filters.status = req.query.status;
  if (req.query.cardType) filters.cardType = req.query.cardType;
  if (req.query.businessType) filters.businessType = req.query.businessType;
  if (req.query.communityId) filters.communityId = req.query.communityId;
  if (req.query.isAgent !== undefined) filters.isAgent = req.query.isAgent;
  if (req.query.isReviewRequired !== undefined) filters.isReviewRequired = req.query.isReviewRequired;
  if (req.query.startDate) filters.startDate = req.query.startDate;
  if (req.query.endDate) filters.endDate = req.query.endDate;
  if (req.query.createdStartDate) filters.createdStartDate = req.query.createdStartDate;
  if (req.query.createdEndDate) filters.createdEndDate = req.query.createdEndDate;
  if (req.query.cancelReasonCode) filters.cancelReasonCode = req.query.cancelReasonCode;
  if (req.query.assignedWindowId) filters.assignedWindowId = req.query.assignedWindowId;
  if (req.query.idCardKey) filters.idCardKey = req.query.idCardKey;
  return filters;
}

router.post('/predict', (req, res) => {
  const validation = validateAppointmentSubmission(req.body);

  if (!validation.valid) {
    return res.json(fail(400, '参数校验失败', { errors: validation.errors }));
  }

  const { normalized } = validation;
  const prediction = predictAppointment(normalized);

  res.json(success({
    canReserve: prediction.canReserve,
    rulePassed: prediction.rulePassed,
    ruleCheckResult: prediction.ruleCheckResult,
    recommendedWindow: prediction.recommendedWindow,
    alternativeWindows: prediction.alternativeWindows,
    recommendedTimeSlot: prediction.recommendedTimeSlot,
    alternativeTimeSlots: prediction.alternativeTimeSlots,
    estimatedWaitMinutes: prediction.estimatedWaitMinutes,
    businessMinutes: prediction.businessMinutes,
    diversionSuggestions: prediction.diversionSuggestions,
    cannotReserveReasons: prediction.cannotReserveReasons,
    supplementaryMaterials: prediction.supplementaryMaterials,
    specialReminders: prediction.specialReminders,
    isReviewRequired: prediction.isReviewRequired,
    isAgent: prediction.isAgent,
    agentComplexity: prediction.agentComplexity
  }, prediction.canReserve ? '预约预判通过，可发起预约' : '预约预判未通过'));
});

router.post('/create', (req, res) => {
  const validation = validateAppointmentSubmission(req.body);

  if (!validation.valid) {
    return res.json(fail(400, '参数校验失败', { errors: validation.errors }));
  }

  const { normalized } = validation;
  const result = createAppointment(normalized);

  if (!result.success) {
    return res.json(fail(400, result.reason || '预约创建失败', {
      cannotReserveReasons: result.cannotReserveReasons,
      supplementaryMaterials: result.supplementaryMaterials,
      duplicateCheck: result.duplicateCheck,
      prediction: result.prediction
    }));
  }

  res.json(success({
    appointment: result.appointment,
    prediction: result.prediction
  }, '预约创建成功'));
});

router.post('/confirm/:id', (req, res) => {
  const { id } = req.params;
  const { operatorId, operatorName, remark } = req.body || {};

  const result = confirmAppointment(
    id,
    operatorId || 'system',
    operatorName || '系统',
    remark
  );

  if (!result.success) {
    return res.json(fail(400, result.reason || '确认失败', {
      currentStatus: result.currentStatus
    }));
  }

  res.json(success({ appointment: result.appointment }, '预约确认成功'));
});

router.post('/cancel/:id', (req, res) => {
  const { id } = req.params;
  const validation = validateAppointmentCancel(req.body || {});

  if (!validation.valid) {
    return res.json(fail(400, '参数校验失败', { errors: validation.errors }));
  }

  const { reasonCode, reason, remark, operatorId, operatorName } = validation.normalized;
  const result = cancelAppointment(
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

  res.json(success({ appointment: result.appointment }, '预约取消成功'));
});

router.get('/', (req, res) => {
  const page = Number(req.query.page) || 1;
  const pageSize = Number(req.query.pageSize) || 20;
  const filters = parseAppointmentFilters(req);

  const result = getAppointments(page, pageSize, filters);
  res.json(success(result));
});

router.get('/:id', (req, res) => {
  const apt = getAppointmentById(req.params.id);
  if (!apt) {
    return res.json(fail(404, '预约记录不存在'));
  }
  res.json(success(apt));
});

router.delete('/', (req, res) => {
  clearAllAppointments();
  res.json(success(null, '已清空所有预约记录'));
});

router.get('/config/window-types', (req, res) => {
  const list = Object.values(windowTypes).map(w => ({
    id: w.id,
    name: w.name,
    description: w.description,
    supportedCardTypes: w.supportedCardTypes,
    supportedBusinessTypes: w.supportedBusinessTypes,
    agePreference: w.agePreference,
    agentOnly: w.agentOnly || false,
    reviewRequired: w.reviewRequired || false
  }));
  res.json(success({ list, total: list.length }));
});

router.get('/config/time-slots', (req, res) => {
  const slots = getAllTimeSlots();
  const periods = Object.entries(timeSlots).map(([key, val]) => ({
    id: key,
    name: val.name,
    startTime: val.startTime,
    endTime: val.endTime,
    slotMinutes: val.slotMinutes,
    slots: val.slots
  }));
  res.json(success({
    periods,
    timeSlotNames,
    allSlots: slots,
    totalPeriods: periods.length,
    totalSlots: slots.length
  }));
});

router.get('/config/community-windows/:communityId', (req, res) => {
  const { communityId } = req.params;
  const config = getCommunityWindowConfig(communityId);
  if (!config) {
    return res.json(fail(404, '未找到该社区窗口配置'));
  }
  res.json(success(config));
});

router.get('/config/business-time/:cardType/:businessType', (req, res) => {
  const { cardType, businessType } = req.params;
  const isAgent = req.query.isAgent === 'true';
  const isReview = req.query.isReview === 'true';
  const agentRelation = req.query.agentRelation || null;

  const minutes = getBusinessTime(cardType, businessType, isAgent, isReview, agentRelation);
  res.json(success({
    cardType,
    businessType,
    isAgent,
    isReview,
    agentRelation,
    businessMinutes: minutes
  }));
});

router.get('/config/statuses', (req, res) => {
  const list = Object.entries(appointmentStatusNames).map(([key, name]) => ({
    status: key,
    name,
    code: appointmentStatus[key.toUpperCase()] || key
  }));
  res.json(success({ list, total: list.length }));
});

router.get('/config/cancel-reasons', (req, res) => {
  const list = Object.entries(cancelReasons).map(([code, name]) => ({ code, name }));
  res.json(success({ list, total: list.length }));
});

router.get('/window-status/:communityId/:expectedDate?', (req, res) => {
  const { communityId, expectedDate } = req.params;
  const date = expectedDate || new Date().toISOString().split('T')[0];
  const status = getWindowStatus(communityId, date);
  if (!status) {
    return res.json(fail(404, '未找到窗口配置'));
  }
  res.json(success(status));
});

router.get('/stats/overview', (req, res) => {
  const filters = parseAppointmentFilters(req);
  const data = getAppointmentOverview(filters);
  res.json(success(data));
});

router.get('/stats/communities', (req, res) => {
  const filters = parseAppointmentFilters(req);
  const data = getCommunityAppointmentStats(filters);
  res.json(success(data));
});

router.get('/stats/window-load', (req, res) => {
  const filters = parseAppointmentFilters(req);
  const data = getWindowLoadRanking(filters);
  res.json(success(data));
});

router.get('/stats/average-wait-time', (req, res) => {
  const filters = parseAppointmentFilters(req);
  const data = getAverageWaitTimeStats(filters);
  res.json(success(data));
});

router.get('/stats/cannot-reserve-reasons', (req, res) => {
  const filters = parseAppointmentFilters(req);
  const data = getCannotReserveReasonRanking(filters);
  res.json(success(data));
});

router.get('/stats/review-ratio', (req, res) => {
  const filters = parseAppointmentFilters(req);
  const data = getReviewAppointmentRatio(filters);
  res.json(success(data));
});

router.get('/stats/agent-success-rate', (req, res) => {
  const filters = parseAppointmentFilters(req);
  const data = getAgentAppointmentSuccessRate(filters);
  res.json(success(data));
});

module.exports = router;
