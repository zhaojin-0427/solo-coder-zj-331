const express = require('express');
const router = express.Router();
const { success } = require('../utils/response');
const {
  getCardTypeStats,
  getBusinessTypeStats,
  getMissingMaterialsRanking,
  getExpiredMaterialsRanking,
  getAlternativeMaterialsUsageRanking,
  getRuleVersionHits,
  getSeniorReviewStats,
  getCommunityDistribution,
  getCommunityScenarioDistribution,
  getAgentFailReasons,
  getAgeDistribution,
  getScenarioDistribution,
  getOverview
} = require('../services/statsService');

function parseFilterParams(req) {
  const filters = {};

  if (req.query.cardType) {
    filters.cardType = req.query.cardType;
  }
  if (req.query.businessType) {
    filters.businessType = req.query.businessType;
  }
  if (req.query.ruleVersion) {
    filters.ruleVersion = req.query.ruleVersion;
  }
  if (req.query.communityId) {
    filters.communityId = req.query.communityId;
  }
  if (req.query.startDate) {
    filters.startDate = req.query.startDate;
  }
  if (req.query.endDate) {
    filters.endDate = req.query.endDate;
  }
  if (req.query.reviewType) {
    filters.reviewType = req.query.reviewType;
  }

  return filters;
}

router.get('/overview', (req, res) => {
  const filters = parseFilterParams(req);
  const data = getOverview(filters);
  res.json(success(data));
});

router.get('/card-types', (req, res) => {
  const filters = parseFilterParams(req);
  const data = getCardTypeStats(filters);
  res.json(success(data));
});

router.get('/business-types', (req, res) => {
  const filters = parseFilterParams(req);
  const data = getBusinessTypeStats(filters);
  res.json(success(data));
});

router.get('/missing-materials', (req, res) => {
  const filters = parseFilterParams(req);
  const data = getMissingMaterialsRanking(filters);
  res.json(success(data));
});

router.get('/expired-materials', (req, res) => {
  const filters = parseFilterParams(req);
  const data = getExpiredMaterialsRanking(filters);
  res.json(success(data));
});

router.get('/alternative-materials-usage', (req, res) => {
  const filters = parseFilterParams(req);
  const data = getAlternativeMaterialsUsageRanking(filters);
  res.json(success(data));
});

router.get('/rule-version-hits', (req, res) => {
  const filters = parseFilterParams(req);
  const data = getRuleVersionHits(filters);
  res.json(success(data));
});

router.get('/senior-review', (req, res) => {
  const filters = parseFilterParams(req);
  const data = getSeniorReviewStats(filters);
  res.json(success(data));
});

router.get('/communities', (req, res) => {
  const filters = parseFilterParams(req);
  const data = getCommunityDistribution(filters);
  res.json(success(data));
});

router.get('/community-scenarios', (req, res) => {
  const filters = parseFilterParams(req);
  const data = getCommunityScenarioDistribution(filters);
  res.json(success(data));
});

router.get('/agent-fail-reasons', (req, res) => {
  const filters = parseFilterParams(req);
  const data = getAgentFailReasons(filters);
  res.json(success(data));
});

router.get('/age-distribution', (req, res) => {
  const filters = parseFilterParams(req);
  const data = getAgeDistribution(filters);
  res.json(success(data));
});

router.get('/scenarios', (req, res) => {
  const filters = parseFilterParams(req);
  const data = getScenarioDistribution(filters);
  res.json(success(data));
});

module.exports = router;
