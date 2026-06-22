const express = require('express');
const router = express.Router();
const { success, fail } = require('../utils/response');
const { validatePolicyAnnouncementSubmission } = require('../utils/validator');
const {
  createAnnouncement,
  getAnnouncements,
  getAnnouncementById,
  publishAnnouncement,
  revokeAnnouncement,
  archiveAnnouncement,
  getImpactAssessment,
  clearAllAnnouncements,
  announcementStatus,
  announcementStatusNames,
  riskLevels
} = require('../services/policyAnnouncementService');
const {
  getCommunityAnnouncementStats,
  getCardTypeBusinessImpactStats,
  getPendingNotificationStats,
  getMaterialChangeRanking,
  getHighRiskPolicyRatio,
  getAnnouncementOverview
} = require('../services/policyAnnouncementStatsService');

function parseFilters(req) {
  const filters = {};
  if (req.query.status) filters.status = req.query.status;
  if (req.query.applicableCardType) filters.applicableCardType = req.query.applicableCardType;
  if (req.query.applicableBusinessType) filters.applicableBusinessType = req.query.applicableBusinessType;
  if (req.query.applicableCommunity) filters.applicableCommunity = req.query.applicableCommunity;
  if (req.query.effectiveStartDate) filters.effectiveStartDate = req.query.effectiveStartDate;
  if (req.query.effectiveEndDate) filters.effectiveEndDate = req.query.effectiveEndDate;
  if (req.query.keyword) filters.keyword = req.query.keyword;
  if (req.query.parentAnnouncementId) filters.parentAnnouncementId = req.query.parentAnnouncementId;
  return filters;
}

router.post('/create', (req, res) => {
  const validation = validatePolicyAnnouncementSubmission(req.body);

  if (!validation.valid) {
    return res.json(fail(400, '参数校验失败', { errors: validation.errors }));
  }

  const result = createAnnouncement(validation.normalized);
  res.json(success({ announcement: result.announcement }, '政策公告草稿创建成功'));
});

router.get('/', (req, res) => {
  const page = Number(req.query.page) || 1;
  const pageSize = Number(req.query.pageSize) || 20;
  const filters = parseFilters(req);

  const result = getAnnouncements(page, pageSize, filters);
  res.json(success(result));
});

router.get('/:id', (req, res) => {
  const announcement = getAnnouncementById(req.params.id);
  if (!announcement) {
    return res.json(fail(404, '公告不存在'));
  }
  res.json(success(announcement));
});

router.post('/publish/:id', (req, res) => {
  const { id } = req.params;
  const { operatorId, operatorName } = req.body || {};

  const result = publishAnnouncement(id, operatorId || 'system', operatorName || '系统');

  if (!result.success) {
    return res.json(fail(400, result.reason));
  }

  res.json(success({ announcement: result.announcement }, '政策公告发布成功'));
});

router.post('/revoke/:id', (req, res) => {
  const { id } = req.params;
  const { reason, operatorId, operatorName } = req.body || {};

  const result = revokeAnnouncement(id, reason, operatorId || 'system', operatorName || '系统');

  if (!result.success) {
    return res.json(fail(400, result.reason));
  }

  res.json(success({ announcement: result.announcement }, '政策公告已撤回'));
});

router.post('/archive/:id', (req, res) => {
  const { id } = req.params;
  const { operatorId, operatorName } = req.body || {};

  const result = archiveAnnouncement(id, operatorId || 'system', operatorName || '系统');

  if (!result.success) {
    return res.json(fail(400, result.reason));
  }

  res.json(success({ announcement: result.announcement }, '政策公告已归档'));
});

router.post('/impact-assessment/:id', (req, res) => {
  const { id } = req.params;
  const result = getImpactAssessment(id);

  if (!result.success) {
    return res.json(fail(404, result.reason));
  }

  res.json(success(result.assessment, '影响评估完成'));
});

router.delete('/', (req, res) => {
  clearAllAnnouncements();
  res.json(success(null, '已清空所有政策公告'));
});

router.get('/config/statuses', (req, res) => {
  const list = Object.entries(announcementStatusNames).map(([key, name]) => ({
    status: key,
    name,
    code: announcementStatus[key.toUpperCase()] || key
  }));
  res.json(success({ list, total: list.length }));
});

router.get('/config/risk-levels', (req, res) => {
  const list = Object.values(riskLevels).map(level => ({
    level: level.level,
    name: level.name,
    score: level.score
  }));
  res.json(success({ list, total: list.length }));
});

router.get('/stats/overview', (req, res) => {
  const filters = parseFilters(req);
  const data = getAnnouncementOverview(filters);
  res.json(success(data));
});

router.get('/stats/communities', (req, res) => {
  const filters = parseFilters(req);
  const data = getCommunityAnnouncementStats(filters);
  res.json(success(data));
});

router.get('/stats/card-business-impact', (req, res) => {
  const filters = parseFilters(req);
  const data = getCardTypeBusinessImpactStats(filters);
  res.json(success(data));
});

router.get('/stats/pending-notifications', (req, res) => {
  const filters = parseFilters(req);
  const data = getPendingNotificationStats(filters);
  res.json(success(data));
});

router.get('/stats/material-change-ranking', (req, res) => {
  const filters = parseFilters(req);
  const data = getMaterialChangeRanking(filters);
  res.json(success(data));
});

router.get('/stats/high-risk-ratio', (req, res) => {
  const filters = parseFilters(req);
  const data = getHighRiskPolicyRatio(filters);
  res.json(success(data));
});

module.exports = router;
