const express = require('express');
const router = express.Router();
const { success, fail } = require('../utils/response');
const { getRecords, getRecordById, clearAll } = require('../services/historyService');

router.get('/', (req, res) => {
  const page = Number(req.query.page) || 1;
  const pageSize = Number(req.query.pageSize) || 20;
  const filters = {
    cardType: req.query.cardType || null,
    businessType: req.query.businessType || null
  };

  if (req.query.canProceed !== undefined) {
    filters.canProceed = req.query.canProceed === 'true';
  }
  if (req.query.isAgent !== undefined) {
    filters.isAgent = req.query.isAgent === 'true';
  }

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
