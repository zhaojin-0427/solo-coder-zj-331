const { getRecordsForStats } = require('./historyService');
const { materialNames, agentRelationNames, businessTypeNames, communityNames } = require('../config/rules');
const cardTypes = require('../config/cardTypes');

function getCardTypeStats(filters = {}) {
  const records = getRecordsForStats(filters);
  const stats = {};

  for (const key of Object.keys(cardTypes)) {
    stats[key] = {
      cardType: key,
      cardName: cardTypes[key].name,
      count: 0,
      successCount: 0,
      failCount: 0,
      agentCount: 0,
      seniorReviewCount: 0
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
      if (record.seniorReviewTriggered) {
        stats[record.cardType].seniorReviewCount++;
      }
    }
  }

  const list = Object.values(stats).sort((a, b) => b.count - a.count);
  return {
    total: records.length,
    list,
    filters
  };
}

function getBusinessTypeStats(filters = {}) {
  const records = getRecordsForStats(filters);
  const stats = {};

  for (const key of Object.keys(businessTypeNames)) {
    stats[key] = {
      businessType: key,
      businessName: businessTypeNames[key],
      count: 0,
      successCount: 0,
      failCount: 0,
      seniorReviewCount: 0
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
      if (record.seniorReviewTriggered) {
        stats[record.businessType].seniorReviewCount++;
      }
    }
  }

  const list = Object.values(stats).sort((a, b) => b.count - a.count);
  return {
    total: records.length,
    list,
    filters
  };
}

function getMissingMaterialsRanking(filters = {}) {
  const records = getRecordsForStats(filters);
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
    ranking,
    filters
  };
}

function getExpiredMaterialsRanking(filters = {}) {
  const records = getRecordsForStats(filters);
  const materialCount = {};

  for (const record of records) {
    const expired = record.result?.expiredMaterials || [];
    for (const m of expired) {
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
    ranking,
    filters
  };
}

function getAlternativeMaterialsUsageRanking(filters = {}) {
  const records = getRecordsForStats(filters);
  const usageCount = {};

  for (const record of records) {
    const alternatives = record.result?.alternativeSuggestions || [];
    for (const alt of alternatives) {
      if (alt.used && alt.alternatives && alt.alternatives.length > 0) {
        for (const usedAlt of alt.alternatives) {
          const key = usedAlt.key || usedAlt;
          if (!usageCount[key]) {
            usageCount[key] = {
              key,
              name: materialNames[key] || key,
              originalKey: alt.original?.key,
              originalName: alt.original?.name,
              count: 0
            };
          }
          usageCount[key].count++;
        }
      }
    }
  }

  const ranking = Object.values(usageCount).sort((a, b) => b.count - a.count);
  return {
    totalTypes: ranking.length,
    ranking,
    filters
  };
}

function getRuleVersionHits(filters = {}) {
  const records = getRecordsForStats(filters);
  const versionCount = {};

  for (const record of records) {
    const version = record.ruleVersion || 'unknown';
    if (!versionCount[version]) {
      versionCount[version] = {
        version,
        businessType: record.businessType,
        businessName: businessTypeNames[record.businessType] || record.businessType,
        count: 0,
        successCount: 0,
        failCount: 0
      };
    }
    versionCount[version].count++;
    if (record.result?.canProceed) {
      versionCount[version].successCount++;
    } else {
      versionCount[version].failCount++;
    }
  }

  const ranking = Object.values(versionCount).sort((a, b) => b.count - a.count);
  return {
    totalVersions: ranking.length,
    ranking,
    filters
  };
}

function getSeniorReviewStats(filters = {}) {
  const records = getRecordsForStats(filters);
  const triggered = records.filter(r => r.seniorReviewTriggered === true);
  const notTriggered = records.filter(r => !r.seniorReviewTriggered);

  const byAgeThreshold = {};
  for (const record of triggered) {
    const threshold = record.result?.seniorReview?.ageThreshold || 0;
    const key = threshold.toString();
    if (!byAgeThreshold[key]) {
      byAgeThreshold[key] = {
        ageThreshold: threshold,
        count: 0,
        successCount: 0,
        failCount: 0
      };
    }
    byAgeThreshold[key].count++;
    if (record.result?.canProceed) {
      byAgeThreshold[key].successCount++;
    } else {
      byAgeThreshold[key].failCount++;
    }
  }

  return {
    totalRecords: records.length,
    triggeredCount: triggered.length,
    notTriggeredCount: notTriggered.length,
    triggerRate: records.length > 0 ? Number(((triggered.length / records.length) * 100).toFixed(2)) : 0,
    byAgeThreshold: Object.values(byAgeThreshold).sort((a, b) => b.ageThreshold - a.ageThreshold),
    filters
  };
}

function getCommunityDistribution(filters = {}) {
  const records = getRecordsForStats(filters);
  const communityStats = {};

  for (const record of records) {
    const communityId = record.communityId || 'unknown';
    if (!communityStats[communityId]) {
      communityStats[communityId] = {
        communityId,
        communityName: communityNames[communityId] || communityId,
        count: 0,
        successCount: 0,
        failCount: 0,
        byScenario: {}
      };
    }
    communityStats[communityId].count++;
    if (record.result?.canProceed) {
      communityStats[communityId].successCount++;
    } else {
      communityStats[communityId].failCount++;
    }

    const scenarioKey = `${record.cardType}_${record.businessType}`;
    if (!communityStats[communityId].byScenario[scenarioKey]) {
      communityStats[communityId].byScenario[scenarioKey] = {
        cardType: record.cardType,
        cardName: cardTypes[record.cardType]?.name || record.cardType,
        businessType: record.businessType,
        businessName: businessTypeNames[record.businessType] || record.businessType,
        count: 0
      };
    }
    communityStats[communityId].byScenario[scenarioKey].count++;
  }

  const list = Object.values(communityStats).map(c => ({
    ...c,
    byScenario: Object.values(c.byScenario).sort((a, b) => b.count - a.count)
  })).sort((a, b) => b.count - a.count);

  return {
    totalCommunities: list.length,
    list,
    filters
  };
}

function getCommunityScenarioDistribution(filters = {}) {
  const records = getRecordsForStats(filters);
  const scenarios = {};

  for (const record of records) {
    const communityId = record.communityId || 'unknown';
    const key = `${communityId}_${record.cardType}_${record.businessType}`;
    if (!scenarios[key]) {
      scenarios[key] = {
        communityId,
        communityName: communityNames[communityId] || communityId,
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
    list,
    filters
  };
}

function getAgentFailReasons(filters = {}) {
  const records = getRecordsForStats(filters);
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
    ranking,
    filters
  };
}

function getAgeDistribution(filters = {}) {
  const records = getRecordsForStats(filters);
  const ranges = [
    { label: '60岁以下', min: 0, max: 59, count: 0, successCount: 0, failCount: 0 },
    { label: '60-64岁', min: 60, max: 64, count: 0, successCount: 0, failCount: 0 },
    { label: '65-69岁', min: 65, max: 69, count: 0, successCount: 0, failCount: 0 },
    { label: '70-74岁', min: 70, max: 74, count: 0, successCount: 0, failCount: 0 },
    { label: '75-79岁', min: 75, max: 79, count: 0, successCount: 0, failCount: 0 },
    { label: '80-84岁', min: 80, max: 84, count: 0, successCount: 0, failCount: 0 },
    { label: '85岁及以上', min: 85, max: 200, count: 0, successCount: 0, failCount: 0 }
  ];

  for (const record of records) {
    const age = record.age || 0;
    for (const range of ranges) {
      if (age >= range.min && age <= range.max) {
        range.count++;
        if (record.result?.canProceed) {
          range.successCount++;
        } else {
          range.failCount++;
        }
        break;
      }
    }
  }

  return {
    total: records.length,
    distribution: ranges,
    filters
  };
}

function getScenarioDistribution(filters = {}) {
  const records = getRecordsForStats(filters);
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
        failCount: 0,
        seniorReviewCount: 0
      };
    }
    scenarios[key].count++;
    if (record.result?.canProceed) {
      scenarios[key].successCount++;
    } else {
      scenarios[key].failCount++;
    }
    if (record.seniorReviewTriggered) {
      scenarios[key].seniorReviewCount++;
    }
  }

  const list = Object.values(scenarios).sort((a, b) => b.count - a.count);
  return {
    totalScenarios: list.length,
    list,
    filters
  };
}

function getOverview(filters = {}) {
  const records = getRecordsForStats(filters);
  const cardStats = getCardTypeStats(filters);
  const businessStats = getBusinessTypeStats(filters);
  const missingMaterials = getMissingMaterialsRanking(filters);
  const agentFails = getAgentFailReasons(filters);
  const seniorReview = getSeniorReviewStats(filters);
  const versionHits = getRuleVersionHits(filters);

  const successCount = records.filter(r => r.result?.canProceed).length;
  const agentCount = records.filter(r => r.isAgent).length;

  return {
    totalConsultations: records.length,
    successCount,
    failCount: records.length - successCount,
    successRate: records.length > 0 ? Number(((successCount / records.length) * 100).toFixed(2)) : 0,
    agentCount,
    agentRate: records.length > 0 ? Number(((agentCount / records.length) * 100).toFixed(2)) : 0,
    seniorReviewCount: seniorReview.triggeredCount,
    seniorReviewRate: seniorReview.triggerRate,
    topCardTypes: cardStats.list.slice(0, 3),
    topBusinessTypes: businessStats.list.slice(0, 3),
    topMissingMaterials: missingMaterials.ranking.slice(0, 5),
    topAgentFailReasons: agentFails.ranking.slice(0, 5),
    topRuleVersions: versionHits.ranking.slice(0, 5),
    filters
  };
}

module.exports = {
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
};
