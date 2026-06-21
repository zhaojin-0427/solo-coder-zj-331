const express = require('express');
const router = express.Router();
const { success, fail } = require('../utils/response');
const cardTypes = require('../config/cardTypes');
const { getAllBusinessTypes, getAllMaterialNames, getAllAgentRelations } = require('../services/ruleService');

router.get('/types', (req, res) => {
  const list = Object.values(cardTypes).map(card => ({
    id: card.id,
    name: card.name,
    description: card.description,
    minAge: card.minAge,
    businessTypes: card.businessTypes
  }));
  res.json(success({ list, total: list.length }));
});

router.get('/types/:cardType', (req, res) => {
  const cardType = req.params.cardType;
  const card = cardTypes[cardType];
  if (!card) {
    return res.json(fail(404, '卡证类型不存在'));
  }
  res.json(success({
    id: card.id,
    name: card.name,
    description: card.description,
    minAge: card.minAge,
    businessTypes: card.businessTypes
  }));
});

router.get('/business-types', (req, res) => {
  const types = getAllBusinessTypes();
  const list = Object.entries(types).map(([key, name]) => ({ key, name }));
  res.json(success({ list, total: list.length }));
});

router.get('/materials', (req, res) => {
  const materials = getAllMaterialNames();
  const list = Object.entries(materials).map(([key, name]) => ({ key, name }));
  res.json(success({ list, total: list.length }));
});

router.get('/agent-relations', (req, res) => {
  const relations = getAllAgentRelations();
  const list = Object.entries(relations).map(([key, name]) => ({ key, name }));
  res.json(success({ list, total: list.length }));
});

module.exports = router;
