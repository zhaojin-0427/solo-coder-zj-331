const express = require('express');
const router = express.Router();
const { success } = require('../utils/response');
const {
  getCardTypeStats,
  getBusinessTypeStats,
  getMissingMaterialsRanking,
  getAgentFailReasons,
  getAgeDistribution,
  getScenarioDistribution,
  getOverview
} = require('../services/statsService');

router.get('/overview', (req, res) => {
  const data = getOverview();
  res.json(success(data));
});

router.get('/card-types', (req, res) => {
  const data = getCardTypeStats();
  res.json(success(data));
});

router.get('/business-types', (req, res) => {
  const data = getBusinessTypeStats();
  res.json(success(data));
});

router.get('/missing-materials', (req, res) => {
  const data = getMissingMaterialsRanking();
  res.json(success(data));
});

router.get('/agent-fail-reasons', (req, res) => {
  const data = getAgentFailReasons();
  res.json(success(data));
});

router.get('/age-distribution', (req, res) => {
  const data = getAgeDistribution();
  res.json(success(data));
});

router.get('/scenarios', (req, res) => {
  const data = getScenarioDistribution();
  res.json(success(data));
});

module.exports = router;
