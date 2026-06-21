const express = require('express');
const router = express.Router();
const { success, fail, parseBoolean } = require('../utils/response');
const { validateConsultationSubmission, canArchiveSuccessful } = require('../utils/validator');
const {
  matchRule,
  getRuleConfig,
  getRuleVersions,
  getRuleConfigByVersion,
  getAllCommunities,
  getAllReviewLevels
} = require('../services/ruleService');
const { addRecord } = require('../services/historyService');

router.post('/match', (req, res) => {
  const validation = validateConsultationSubmission(req.body);

  if (!validation.valid) {
    return res.json(fail(400, '参数校验失败', { errors: validation.errors }));
  }

  const { normalized } = validation;
  const {
    cardType,
    businessType,
    age,
    isPresent,
    agentRelation,
    materials,
    materialKeys,
    communityId,
    handleDate
  } = normalized;

  const result = matchRule(cardType, businessType, {
    age,
    isPresent,
    agentRelation,
    materialKeys,
    materials,
    communityId,
    handleDate
  });

  const canProceedSuccessfully = canArchiveSuccessful(result);

  const record = addRecord({
    cardType,
    businessType,
    age,
    isPresent,
    isAgent: !isPresent,
    agentRelation,
    materials,
    materialKeys,
    communityId,
    handleDate,
    result
  }, canProceedSuccessfully);

  res.json(success({
    canProceed: result.canProceed,
    canProceedSuccessfully,
    cardName: result.cardName,
    businessName: result.businessName,
    ruleVersion: result.ruleVersion,
    ageCheck: result.ageCheck,
    presenceRequired: result.presenceRequired,
    isPresent: result.isPresent,
    missingMaterials: result.missingMaterials,
    expiredMaterials: result.expiredMaterials,
    alternativeSuggestions: result.alternativeSuggestions,
    errors: result.errors,
    agentAllowed: result.agentAllowed,
    agentErrors: result.agentErrors,
    agentRestrictions: result.agentRestrictions,
    seniorReview: result.seniorReview,
    nextSteps: result.nextSteps,
    specialReminders: result.specialReminders,
    recordId: record.id
  }, result.canProceed ? '符合办理条件' : '不符合办理条件，请查看缺失项'));
});

router.get('/config/:cardType/:businessType', (req, res) => {
  const { cardType, businessType } = req.params;
  const { communityId, handleDate } = req.query;

  const config = getRuleConfig(cardType, businessType, communityId, handleDate);
  if (!config) {
    return res.json(fail(404, '未找到对应的规则配置'));
  }
  res.json(success(config));
});

router.get('/versions/:businessType', (req, res) => {
  const { businessType } = req.params;
  const versions = getRuleVersions(businessType);
  res.json(success({ list: versions, total: versions.length }));
});

router.get('/config/:cardType/:businessType/version/:version', (req, res) => {
  const { cardType, businessType, version } = req.params;
  const config = getRuleConfigByVersion(cardType, businessType, version);
  if (!config) {
    return res.json(fail(404, '未找到对应版本的规则配置'));
  }
  res.json(success(config));
});

router.get('/communities', (req, res) => {
  const communities = getAllCommunities();
  const list = Object.entries(communities).map(([key, name]) => ({ key, name }));
  res.json(success({ list, total: list.length }));
});

router.get('/review-levels', (req, res) => {
  const levels = getAllReviewLevels();
  const list = Object.entries(levels).map(([key, name]) => ({ key, name }));
  res.json(success({ list, total: list.length }));
});

router.post('/check', (req, res) => {
  const validation = validateConsultationSubmission(req.body);

  if (!validation.valid) {
    return res.json(fail(400, '参数校验失败', { errors: validation.errors }));
  }

  const { normalized } = validation;
  const {
    cardType,
    businessType,
    age,
    isPresent,
    agentRelation,
    materials,
    materialKeys,
    communityId,
    handleDate
  } = normalized;

  const result = matchRule(cardType, businessType, {
    age,
    isPresent,
    agentRelation,
    materialKeys,
    materials,
    communityId,
    handleDate
  });

  res.json(success({
    canProceed: result.canProceed,
    ruleVersion: result.ruleVersion,
    missingSteps: result.missingMaterials.map(m => m.name),
    expiredMaterials: result.expiredMaterials.map(m => m.name),
    alternativeSuggestions: result.alternativeSuggestions,
    agentLimitations: result.agentErrors,
    agentRestrictions: result.agentRestrictions,
    seniorReview: result.seniorReview,
    nextSteps: result.nextSteps,
    specialReminders: result.specialReminders
  }));
});

module.exports = router;
