const { loadHistory } = require('./historyService');
const { materialNames, agentRelationNames, businessTypeNames } = require('../config/rules');
const cardTypes = require('../config/cardTypes');

function getCardTypeStats() {
  const records = loadHistory();
  const stats = {};

  for (const key of Object.keys(cardTypes)) {
    stats[key] = {
      cardType: key,
      cardName: cardTypes[key].name,
      count: 0,
      successCount: 0,
      failCount: 0,
      agentCount: 0
    };
  }

  for (const record of records) {
    if (stats[record.cardType]) {
      stats[record.cardType].count++;
      if (record.result?.canProceed) {
        stats[record.cardType].successCount++;
      } else {
        stats[record.cardType].failCount++;
      }
      if (record.isAgent) {
        stats[record.cardType].agentCount++;
      }
    }
  }

  const list = Object.values(stats).sort((a, b) => b.count - a.count);
  return {
    total: records.length,
    list
  };
}

function getBusinessTypeStats() {
  const records = loadHistory();
  const stats = {};

  for (const key of Object.keys(businessTypeNames)) {
    stats[key] = {
      businessType: key,
      businessName: businessTypeNames[key],
      count: 0,
      successCount: 0,
      failCount: 0
    };
  }

  for (const record of records) {
    if (stats[record.businessType]) {
      stats[record.businessType].count++;
      if (record.result?.canProceed) {
        stats[record.businessType].successCount++;
      } else {
        stats[record.businessType].failCount++;
      }
    }
  }

  const list = Object.values(stats).sort((a, b) => b.count - a.count);
  return {
    total: records.length,
    list
  };
}

function getMissingMaterialsRanking() {
  const records = loadHistory();
  const materialCount = {};

  for (const record of records) {
    const missing = record.result?.missingMaterials || [];
    for (const m of missing) {
      const key = m.key || m;
      if (!materialCount[key]) {
        materialCount[key] = {
          key,
          name: materialNames[key] || key,
          count: 0
        };
      }
      materialCount[key].count++;
    }
  }

  const ranking = Object.values(materialCount).sort((a, b) => b.count - a.count);
  return {
    totalTypes: ranking.length,
    ranking
  };
}

function getAgentFailReasons() {
  const records = loadHistory();
  const agentRecords = records.filter(r => r.isAgent && !r.result?.canProceed);
  const reasonCount = {};

  for (const record of agentRecords) {
    const agentErrors = record.result?.agentErrors || [];
    for (const error of agentErrors) {
      if (!reasonCount[error]) {
        reasonCount[error] = {
          reason: error,
          count: 0
        };
      }
      reasonCount[error].count++;
    }
  }

  const ranking = Object.values(reasonCount).sort((a, b) => b.count - a.count);
  return {
    totalAgentFails: agentRecords.length,
    ranking
  };
}

function getAgeDistribution() {
  const records = loadHistory();
  const ranges = [
    { label: '60岁以下', min: 0, max: 59, count: 0 },
    { label: '60-64岁', min: 60, max: 64, count: 0 },
    { label: '65-69岁', min: 65, max: 69, count: 0 },
    { label: '70-79岁', min: 70, max: 79, count: 0 },
    { label: '80岁及以上', min: 80, max: 200, count: 0 }
  ];

  for (const record of records) {
    const age = record.age || 0;
    for (const range of ranges) {
      if (age >= range.min && age <= range.max) {
        range.count++;
        break;
      }
    }
  }

  return {
    total: records.length,
    distribution: ranges
  };
}

function getScenarioDistribution() {
  const records = loadHistory();
  const scenarios = {};

  for (const record of records) {
    const key = `${record.cardType}_${record.businessType}`;
    if (!scenarios[key]) {
      scenarios[key] = {
        cardType: record.cardType,
        cardName: cardTypes[record.cardType]?.name || record.cardType,
        businessType: record.businessType,
        businessName: businessTypeNames[record.businessType] || record.businessType,
        count: 0,
        successCount: 0,
        failCount: 0
      };
    }
    scenarios[key].count++;
    if (record.result?.canProceed) {
      scenarios[key].successCount++;
    } else {
      scenarios[key].failCount++;
    }
  }

  const list = Object.values(scenarios).sort((a, b) => b.count - a.count);
  return {
    totalScenarios: list.length,
    list
  };
}

function getOverview() {
  const records = loadHistory();
  const cardStats = getCardTypeStats();
  const businessStats = getBusinessTypeStats();
  const missingMaterials = getMissingMaterialsRanking();
  const agentFails = getAgentFailReasons();

  const successCount = records.filter(r => r.result?.canProceed).length;
  const agentCount = records.filter(r => r.isAgent).length;

  return {
    totalConsultations: records.length,
    successCount,
    failCount: records.length - successCount,
    successRate: records.length > 0 ? Number(((successCount / records.length) * 100).toFixed(2)) : 0,
    agentCount,
    agentRate: records.length > 0 ? Number(((agentCount / records.length) * 100).toFixed(2)) : 0,
    topCardTypes: cardStats.list.slice(0, 3),
    topBusinessTypes: businessStats.list.slice(0, 3),
    topMissingMaterials: missingMaterials.ranking.slice(0, 5),
    topAgentFailReasons: agentFails.ranking.slice(0, 5)
  };
}

module.exports = {
  getCardTypeStats,
  getBusinessTypeStats,
  getMissingMaterialsRanking,
  getAgentFailReasons,
  getAgeDistribution,
  getScenarioDistribution,
  getOverview
};
