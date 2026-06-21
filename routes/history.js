const express = require('express');
const router = express.Router();
const { success, fail } = require('../utils/response');
const { getRecords, getRecordById, clearAll } = require('../services/historyService');

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
  if (req.query.canProceed !== undefined) {
    filters.canProceed = req.query.canProceed === 'true';
  }
  if (req.query.isAgent !== undefined) {
    filters.isAgent = req.query.isAgent === 'true';
  }
  if (req.query.canProceedSuccessfully !== undefined) {
    filters.canProceedSuccessfully = req.query.canProceedSuccessfully === 'true';
  }

  return filters;
}

router.get('/', (req, res) => {
  const page = Number(req.query.page) || 1;
  const pageSize = Number(req.query.pageSize) || 20;
  const filters = parseFilterParams(req);

  const result = getRecords(page, pageSize, filters);
  res.json(success(result));
});

router.get('/:id', (req, res) => {
  const record = getRecordById(req.params.id);
  if (!record) {
    return res.json(fail(404, '记录不存在'));
  }
  res.json(success(record));
});

router.delete('/', (req, res) => {
  clearAll();
  res.json(success(null, '已清空所有历史记录'));
});

module.exports = router;
