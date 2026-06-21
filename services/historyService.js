const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/history.json');

let historyCache = null;

function ensureDataFile() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
  }
}

function loadHistory() {
  if (historyCache) {
    return historyCache;
  }
  ensureDataFile();
  try {
    const content = fs.readFileSync(DATA_FILE, 'utf-8');
    historyCache = JSON.parse(content);
  } catch (e) {
    historyCache = [];
  }
  return historyCache;
}

function saveHistory(records) {
  historyCache = records;
  fs.writeFileSync(DATA_FILE, JSON.stringify(records, null, 2));
}

function addRecord(record) {
  const records = loadHistory();
  const newRecord = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 8),
    ...record,
    createdAt: new Date().toISOString()
  };
  records.unshift(newRecord);
  saveHistory(records);
  return newRecord;
}

function getRecords(page = 1, pageSize = 20, filters = {}) {
  let records = loadHistory();

  if (filters.cardType) {
    records = records.filter(r => r.cardType === filters.cardType);
  }
  if (filters.businessType) {
    records = records.filter(r => r.businessType === filters.businessType);
  }
  if (filters.canProceed !== undefined) {
    records = records.filter(r => r.result?.canProceed === filters.canProceed);
  }
  if (filters.isAgent !== undefined) {
    records = records.filter(r => r.isAgent === filters.isAgent);
  }

  const total = records.length;
  const start = (page - 1) * pageSize;
  const list = records.slice(start, start + pageSize);

  return {
    list,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  };
}

function getRecordById(id) {
  const records = loadHistory();
  return records.find(r => r.id === id) || null;
}

function clearAll() {
  saveHistory([]);
  return true;
}

module.exports = {
  addRecord,
  getRecords,
  getRecordById,
  clearAll,
  loadHistory
};
