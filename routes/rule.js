const express = require('express');
const router = express.Router();
const { success, fail } = require('../utils/response');
const { matchRule, getRuleConfig } = require('../services/ruleService');
const { addRecord } = require('../services/historyService');

router.post('/match', (req, res) => {
  const { cardType, businessType, age, isPresent, agentRelation, materials } = req.body;

  if (!cardType) {
    return res.json(fail(400, '请提供卡证类型 cardType'));
  }
  if (!businessType) {
    return res.json(fail(400, '请提供业务类型 businessType'));
  }
  if (age === undefined || age === null) {
    return res.json(fail(400, '请提供老人年龄 age'));
  }
  if (isPresent === undefined || isPresent === null) {
    return res.json(fail(400, '请提供是否本人到场 isPresent'));
  }

  const result = matchRule(cardType, businessType, {
    age: Number(age),
    isPresent: Boolean(isPresent),
    agentRelation: agentRelation || null,
    materials: materials || []
  });

  const record = addRecord({
    cardType,
    businessType,
    age: Number(age),
    isPresent: Boolean(isPresent),
    isAgent: !Boolean(isPresent),
    agentRelation: agentRelation || null,
    materials: materials || [],
    result
  });

  res.json(success({
    canProceed: result.canProceed,
    cardName: result.cardName,
    businessName: result.businessName,
    ageCheck: result.ageCheck,
    presenceRequired: result.presenceRequired,
    isPresent: result.isPresent,
    missingMaterials: result.missingMaterials,
    errors: result.errors,
    agentAllowed: result.agentAllowed,
    agentErrors: result.agentErrors,
    specialReminders: result.specialReminders,
    recordId: record.id
  }, result.canProceed ? '符合办理条件' : '不符合办理条件，请查看缺失项'));
});

router.get('/config/:cardType/:businessType', (req, res) => {
  const { cardType, businessType } = req.params;
  const config = getRuleConfig(cardType, businessType);
  if (!config) {
    return res.json(fail(404, '未找到对应的规则配置'));
  }
  res.json(success(config));
});

router.post('/check', (req, res) => {
  const { cardType, businessType, age, isPresent, agentRelation, materials } = req.body;

  if (!cardType || !businessType || age === undefined || isPresent === undefined) {
    return res.json(fail(400, '缺少必要参数'));
  }

  const result = matchRule(cardType, businessType, {
    age: Number(age),
    isPresent: Boolean(isPresent),
    agentRelation: agentRelation || null,
    materials: materials || []
  });

  res.json(success({
    canProceed: result.canProceed,
    missingSteps: result.missingMaterials.map(m => m.name),
    agentLimitations: result.agentErrors,
    specialReminders: result.specialReminders
  }));
});

module.exports = router;
