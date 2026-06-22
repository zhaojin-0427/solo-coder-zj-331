const {
  getOrdersForStats,
  homeVisitStatus,
  homeVisitStatusNames,
  homeVisitCancelReasons,
  homeVisitFailReasons
} = require('./homeVisitService');
const { communityNames, businessTypeNames, materialNames, agentRelationNames } = require('../config/rules');
const cardTypes = require('../config/cardTypes');
const { fieldStaff, materialRiskLevels } = require('../config/homeVisit');

function getCommunityHomeVisitStats(filters = {}) {
  const records = getOrdersForStats(filters);
  const stats = {};

  for (const key of Object.keys(communityNames)) {
    if (key === 'all') continue;
    stats[key] = {
      communityId: key,
      communityName: communityNames[key],
      total: 0,
      pendingDispatchCount: 0,
      dispatchedCount: 0,
      onSiteCount: 0,
      completedCount: 0,
      cancelledCount: 0,
      expiredCount: 0,
      reviewCount: 0,
      successCount: 0,
      transferredToWindowCount: 0,
      successRate: 0
    };
  }

  for (const rec of records) {
    if (!stats[rec.communityId]) continue;
    const s = stats[rec.communityId];
    s.total++;
    if (rec.status === homeVisitStatus.PENDING_DISPATCH) s.pendingDispatchCount++;
    if (rec.status === homeVisitStatus.DISPATCHED) s.dispatchedCount++;
    if (rec.status === homeVisitStatus.ON_SITE) s.onSiteCount++;
    if (rec.status === homeVisitStatus.COMPLETED) s.completedCount++;
    if (rec.status === homeVisitStatus.CANCELLED) s.cancelledCount++;
    if (rec.status === homeVisitStatus.EXPIRED) s.expiredCount++;
    if (rec.isReviewRequired) s.reviewCount++;
    if (rec.completionResult?.isSuccess) s.successCount++;
    if (rec.transferredToWindow) s.transferredToWindowCount++;
  }

  for (const s of Object.values(stats)) {
    const validTotal = s.total - s.cancelledCount - s.expiredCount;
    if (validTotal > 0) {
      s.successRate = Number(((s.successCount / validTotal) * 100).toFixed(2));
    }
  }

  const list = Object.values(stats).sort((a, b) => b.total - a.total);
  return {
    totalCommunities: list.length,
    list,
    filters
  };
}

function getStaffLoadRanking(filters = {}) {
  const records = getOrdersForStats(filters);
  const loadMap = {};

  for (const staff of fieldStaff) {
    loadMap[staff.staffId] = {
      staffId: staff.staffId,
      staffName: staff.name,
      phone: staff.phone,
      communities: staff.communities,
      skills: staff.skills,
      canReview: staff.canReview,
      dailyCapacity: staff.dailyCapacity,
      totalOrders: 0,
      completedOrders: 0,
      pendingOrders: 0,
      cancelledOrders: 0,
      totalServiceMinutes: 0,
      avgServiceMinutes: 0,
      successRate: 0
    };
  }

  for (const rec of records) {
    const staffId = rec.assignedStaffId;
    if (!staffId || !loadMap[staffId]) continue;

    const entry = loadMap[staffId];
    entry.totalOrders++;

    if (rec.status === homeVisitStatus.COMPLETED) {
      entry.completedOrders++;
      if (rec.completionResult?.actualServiceMinutes) {
        entry.totalServiceMinutes += rec.completionResult.actualServiceMinutes;
      } else {
        entry.totalServiceMinutes += rec.estimatedServiceMinutes || 0;
      }
    }
    if (rec.status === homeVisitStatus.PENDING_DISPATCH || rec.status === homeVisitStatus.DISPATCHED || rec.status === homeVisitStatus.ON_SITE) {
      entry.pendingOrders++;
    }
    if (rec.status === homeVisitStatus.CANCELLED) {
      entry.cancelledOrders++;
    }
  }

  for (const entry of Object.values(loadMap)) {
    if (entry.completedOrders > 0) {
      entry.avgServiceMinutes = Number((entry.totalServiceMinutes / entry.completedOrders).toFixed(1));
    }
    const validTotal = entry.totalOrders - entry.cancelledOrders;
    if (validTotal > 0) {
      entry.successRate = Number(((entry.completedOrders / validTotal) * 100).toFixed(2));
    }
  }

  const list = Object.values(loadMap).sort((a, b) => b.totalOrders - a.totalOrders);
  return {
    totalStaff: list.length,
    ranking: list,
    filters
  };
}

function getAverageHomeVisitTimeStats(filters = {}) {
  const records = getOrdersForStats(filters);
  const completedRecords = records.filter(r =>
    r.status === homeVisitStatus.COMPLETED);

  const byBusinessType = {};
  const byCardType = {};
  const byCommunity = {};
  const byMobilityLevel = {};

  let totalServiceTime = 0;
  let totalEstimatedTime = 0;
  let count = 0;

  for (const rec of completedRecords) {
    const actual = rec.completionResult?.actualServiceMinutes || rec.estimatedServiceMinutes || 0;
    const estimated = rec.estimatedServiceMinutes || 0;
    totalServiceTime += actual;
    totalEstimatedTime += estimated;
    count++;

    const btKey = rec.businessType;
    if (!byBusinessType[btKey]) {
      byBusinessType[btKey] = { businessType: btKey, businessName: businessTypeNames[btKey] || btKey, totalService: 0, totalEstimated: 0, count: 0 };
    }
    byBusinessType[btKey].totalService += actual;
    byBusinessType[btKey].totalEstimated += estimated;
    byBusinessType[btKey].count++;

    const ctKey = rec.cardType;
    if (!byCardType[ctKey]) {
      byCardType[ctKey] = { cardType: ctKey, cardName: cardTypes[ctKey]?.name || ctKey, totalService: 0, totalEstimated: 0, count: 0 };
    }
    byCardType[ctKey].totalService += actual;
    byCardType[ctKey].totalEstimated += estimated;
    byCardType[ctKey].count++;

    const cKey = rec.communityId;
    if (!byCommunity[cKey]) {
      byCommunity[cKey] = { communityId: cKey, communityName: communityNames[cKey] || cKey, totalService: 0, totalEstimated: 0, count: 0 };
    }
    byCommunity[cKey].totalService += actual;
    byCommunity[cKey].totalEstimated += estimated;
    byCommunity[cKey].count++;

    const mlKey = rec.mobilityLevel || 'unknown';
    if (!byMobilityLevel[mlKey]) {
      byMobilityLevel[mlKey] = { mobilityLevel: mlKey, mobilityLevelName: rec.mobilityLevelName || mlKey, totalService: 0, totalEstimated: 0, count: 0 };
    }
    byMobilityLevel[mlKey].totalService += actual;
    byMobilityLevel[mlKey].totalEstimated += estimated;
    byMobilityLevel[mlKey].count++;
  }

  const finalize = obj => Object.values(obj).map(v => ({
    ...v,
    avgServiceMinutes: v.count > 0 ? Number((v.totalService / v.count).toFixed(1)) : 0,
    avgEstimatedMinutes: v.count > 0 ? Number((v.totalEstimated / v.count).toFixed(1)) : 0,
    timeDeviationMinutes: v.count > 0 ? Number(((v.totalService - v.totalEstimated) / v.count).toFixed(1)) : 0
  })).sort((a, b) => b.count - a.count);

  return {
    overall: {
      totalRecords: completedRecords.length,
      avgServiceMinutes: count > 0 ? Number((totalServiceTime / count).toFixed(1)) : 0,
      avgEstimatedMinutes: count > 0 ? Number((totalEstimatedTime / count).toFixed(1)) : 0,
      avgDeviationMinutes: count > 0 ? Number(((totalServiceTime - totalEstimatedTime) / count).toFixed(1)) : 0
    },
    byBusinessType: finalize(byBusinessType),
    byCardType: finalize(byCardType),
    byCommunity: finalize(byCommunity),
    byMobilityLevel: finalize(byMobilityLevel),
    filters
  };
}

function getCannotDispatchReasonRanking(filters = {}) {
  const records = getOrdersForStats(filters);
  const cancelledRecords = records.filter(r => r.status === homeVisitStatus.CANCELLED);
  const failedRecords = records.filter(r => r.status === homeVisitStatus.CANCELLED && r.failReasonCodes?.length > 0);

  const reasonCount = {};

  for (const rec of cancelledRecords) {
    const code = rec.cancelReasonCode || 'other';
    if (!reasonCount[code]) {
      reasonCount[code] = {
        code,
        name: homeVisitCancelReasons[code] || code,
        category: 'cancelled',
        count: 0
      };
    }
    reasonCount[code].count++;
  }

  for (const rec of failedRecords) {
    const codes = rec.failReasonCodes || ['other'];
    for (const code of codes) {
      if (!reasonCount[code]) {
        reasonCount[code] = {
          code,
          name: homeVisitFailReasons[code] || code,
          category: 'failed',
          count: 0
        };
      }
      reasonCount[code].count++;
    }
  }

  const ranking = Object.values(reasonCount).sort((a, b) => b.count - a.count);

  const expiredRecords = records.filter(r => r.status === homeVisitStatus.EXPIRED);

  return {
    totalCancelled: cancelledRecords.length,
    totalExpired: expiredRecords.length,
    totalFailed: failedRecords.length,
    totalUnsuccessful: cancelledRecords.length + expiredRecords.length,
    ranking,
    filters
  };
}

function getSeniorReviewHomeVisitRatio(filters = {}) {
  const records = getOrdersForStats(filters);
  const totalRecords = records.filter(r =>
    r.status !== homeVisitStatus.CANCELLED && r.status !== homeVisitStatus.EXPIRED);

  const reviewRecords = totalRecords.filter(r => r.isReviewRequired === true);
  const nonReviewRecords = totalRecords.filter(r => r.isReviewRequired !== true);

  const byCommunity = {};
  for (const rec of totalRecords) {
    const cKey = rec.communityId;
    if (!byCommunity[cKey]) {
      byCommunity[cKey] = {
        communityId: cKey,
        communityName: communityNames[cKey] || cKey,
        total: 0,
        reviewCount: 0
      };
    }
    byCommunity[cKey].total++;
    if (rec.isReviewRequired) byCommunity[cKey].reviewCount++;
  }

  const ageGroups = [
    { label: '60-69岁', min: 60, max: 69, total: 0, review: 0 },
    { label: '70-79岁', min: 70, max: 79, total: 0, review: 0 },
    { label: '80-84岁', min: 80, max: 84, total: 0, review: 0 },
    { label: '85岁及以上', min: 85, max: 200, total: 0, review: 0 }
  ];
  for (const rec of totalRecords) {
    const age = rec.age || 0;
    for (const g of ageGroups) {
      if (age >= g.min && age <= g.max) {
        g.total++;
        if (rec.isReviewRequired) g.review++;
        break;
      }
    }
  }

  const byBusinessType = {};
  for (const rec of totalRecords) {
    const bt = rec.businessType;
    if (!byBusinessType[bt]) {
      byBusinessType[bt] = {
        businessType: bt,
        businessName: businessTypeNames[bt] || bt,
        total: 0,
        reviewCount: 0
      };
    }
    byBusinessType[bt].total++;
    if (rec.isReviewRequired) byBusinessType[bt].reviewCount++;
  }

  return {
    totalOrders: totalRecords.length,
    reviewOrders: reviewRecords.length,
    nonReviewOrders: nonReviewRecords.length,
    reviewRatio: totalRecords.length > 0
      ? Number(((reviewRecords.length / totalRecords.length) * 100).toFixed(2))
      : 0,
    byCommunity: Object.values(byCommunity).map(v => ({
      ...v,
      reviewRatio: v.total > 0 ? Number((v.reviewCount / v.total * 100).toFixed(2)) : 0
    })).sort((a, b) => b.reviewRatio - a.reviewRatio),
    byAgeGroup: ageGroups.map(g => ({
      ...g,
      reviewRatio: g.total > 0 ? Number((g.review / g.total * 100).toFixed(2)) : 0
    })),
    byBusinessType: Object.values(byBusinessType).map(v => ({
      ...v,
      reviewRatio: v.total > 0 ? Number((v.reviewCount / v.total * 100).toFixed(2)) : 0
    })).sort((a, b) => b.reviewRatio - a.reviewRatio),
    filters
  };
}

function getMaterialCompletionSuccessRate(filters = {}) {
  const records = getOrdersForStats(filters);
  const completedRecords = records.filter(r => r.status === homeVisitStatus.COMPLETED);

  const totalCompleted = completedRecords.length;
  const successOnSite = completedRecords.filter(r => r.completionResult?.isSuccess === true).length;
  const hasMissingMaterials = completedRecords.filter(r =>
    r.completionResult?.materialsMissing && r.completionResult.materialsMissing.length > 0
  ).length;
  const transferredToWindow = completedRecords.filter(r => r.transferredToWindow === true).length;

  const byRiskLevel = {};
  for (const level of Object.values(materialRiskLevels)) {
    byRiskLevel[level.level] = {
      riskLevel: level.level,
      riskLevelName: level.name,
      total: 0,
      success: 0,
      missingMaterials: 0,
      transferred: 0
    };
  }

  for (const rec of records) {
    const level = rec.materialRiskLevel || 'low';
    if (!byRiskLevel[level]) {
      byRiskLevel[level] = {
        riskLevel: level,
        riskLevelName: materialRiskLevels[level]?.name || level,
        total: 0,
        success: 0,
        missingMaterials: 0,
        transferred: 0
      };
    }
    const entry = byRiskLevel[level];
    entry.total++;
    if (rec.status === homeVisitStatus.COMPLETED && rec.completionResult?.isSuccess) {
      entry.success++;
    }
    if (rec.completionResult?.materialsMissing?.length > 0) {
      entry.missingMaterials++;
    }
    if (rec.transferredToWindow) {
      entry.transferred++;
    }
  }

  const byBusinessType = {};
  for (const rec of records) {
    const bt = rec.businessType;
    if (!byBusinessType[bt]) {
      byBusinessType[bt] = {
        businessType: bt,
        businessName: businessTypeNames[bt] || bt,
        total: 0,
        success: 0,
        missingMaterials: 0,
        transferred: 0
      };
    }
    const entry = byBusinessType[bt];
    entry.total++;
    if (rec.status === homeVisitStatus.COMPLETED && rec.completionResult?.isSuccess) {
      entry.success++;
    }
    if (rec.completionResult?.materialsMissing?.length > 0) {
      entry.missingMaterials++;
    }
    if (rec.transferredToWindow) {
      entry.transferred++;
    }
  }

  const calcRate = (total, success) => total > 0 ? Number((success / total * 100).toFixed(2)) : 0;

  return {
    totalCompleted,
    successOnSite,
    successRate: calcRate(totalCompleted, successOnSite),
    hasMissingMaterials,
    missingRate: calcRate(totalCompleted, hasMissingMaterials),
    transferredToWindow,
    transferRate: calcRate(totalCompleted, transferredToWindow),
    byRiskLevel: Object.values(byRiskLevel).map(v => ({
      ...v,
      successRate: calcRate(v.total, v.success),
      missingRate: calcRate(v.total, v.missingMaterials),
      transferRate: calcRate(v.total, v.transferred)
    })).sort((a, b) => b.total - a.total),
    byBusinessType: Object.values(byBusinessType).map(v => ({
      ...v,
      successRate: calcRate(v.total, v.success),
      missingRate: calcRate(v.total, v.missingMaterials),
      transferRate: calcRate(v.total, v.transferred)
    })).sort((a, b) => b.total - a.total),
    filters
  };
}

function getWindowTransferDistribution(filters = {}) {
  const records = getOrdersForStats(filters);
  const transferredRecords = records.filter(r => r.transferredToWindow === true);

  const byReason = {};
  const byCommunity = {};
  const byBusinessType = {};
  const byCardType = {};
  const byRiskLevel = {};

  for (const rec of transferredRecords) {
    const reason = rec.transferReason || '其他原因';
    if (!byReason[reason]) {
      byReason[reason] = { reason, count: 0 };
    }
    byReason[reason].count++;

    const cKey = rec.communityId;
    if (!byCommunity[cKey]) {
      byCommunity[cKey] = { communityId: cKey, communityName: communityNames[cKey] || cKey, count: 0 };
    }
    byCommunity[cKey].count++;

    const bt = rec.businessType;
    if (!byBusinessType[bt]) {
      byBusinessType[bt] = { businessType: bt, businessName: businessTypeNames[bt] || bt, count: 0 };
    }
    byBusinessType[bt].count++;

    const ct = rec.cardType;
    if (!byCardType[ct]) {
      byCardType[ct] = { cardType: ct, cardName: cardTypes[ct]?.name || ct, count: 0 };
    }
    byCardType[ct].count++;

    const rl = rec.materialRiskLevel || 'low';
    if (!byRiskLevel[rl]) {
      byRiskLevel[rl] = { riskLevel: rl, riskLevelName: materialRiskLevels[rl]?.name || rl, count: 0 };
    }
    byRiskLevel[rl].count++;
  }

  const totalTransferred = transferredRecords.length;
  const totalOrders = records.length;

  return {
    totalOrders,
    totalTransferred,
    transferRate: totalOrders > 0 ? Number((totalTransferred / totalOrders * 100).toFixed(2)) : 0,
    byReason: Object.values(byReason).sort((a, b) => b.count - a.count),
    byCommunity: Object.values(byCommunity).sort((a, b) => b.count - a.count),
    byBusinessType: Object.values(byBusinessType).sort((a, b) => b.count - a.count),
    byCardType: Object.values(byCardType).sort((a, b) => b.count - a.count),
    byRiskLevel: Object.values(byRiskLevel).sort((a, b) => b.count - a.count),
    filters
  };
}

function getHomeVisitOverview(filters = {}) {
  const records = getOrdersForStats(filters);

  const total = records.length;
  const pendingDispatch = records.filter(r => r.status === homeVisitStatus.PENDING_DISPATCH).length;
  const dispatched = records.filter(r => r.status === homeVisitStatus.DISPATCHED).length;
  const onSite = records.filter(r => r.status === homeVisitStatus.ON_SITE).length;
  const completed = records.filter(r => r.status === homeVisitStatus.COMPLETED).length;
  const cancelled = records.filter(r => r.status === homeVisitStatus.CANCELLED).length;
  const expired = records.filter(r => r.status === homeVisitStatus.EXPIRED).length;

  const reviewCount = records.filter(r => r.isReviewRequired === true).length;
  const dualVerifyCount = records.filter(r => r.needsDualVerify === true).length;
  const transferredToWindow = records.filter(r => r.transferredToWindow === true).length;

  const validTotal = total - cancelled - expired;
  const successRate = validTotal > 0
    ? Number(((completed / validTotal) * 100).toFixed(2))
    : 0;

  const timeStats = getAverageHomeVisitTimeStats(filters);
  const communityStats = getCommunityHomeVisitStats(filters);
  const staffStats = getStaffLoadRanking(filters);

  return {
    totalOrders: total,
    pendingDispatchCount: pendingDispatch,
    dispatchedCount: dispatched,
    onSiteCount: onSite,
    completedCount: completed,
    cancelledCount: cancelled,
    expiredCount: expired,
    successRate,
    reviewCount,
    reviewRatio: total > 0 ? Number(((reviewCount / total) * 100).toFixed(2)) : 0,
    dualVerifyCount,
    dualVerifyRatio: total > 0 ? Number(((dualVerifyCount / total) * 100).toFixed(2)) : 0,
    transferredToWindowCount: transferredToWindow,
    transferRate: total > 0 ? Number(((transferredToWindow / total) * 100).toFixed(2)) : 0,
    avgServiceMinutes: timeStats.overall.avgServiceMinutes,
    avgTotalMinutes: timeStats.overall.avgServiceMinutes,
    topCommunities: communityStats.list.slice(0, 5),
    topStaff: staffStats.ranking.slice(0, 5),
    statusDistribution: [
      { status: homeVisitStatus.PENDING_DISPATCH, name: homeVisitStatusNames[homeVisitStatus.PENDING_DISPATCH], count: pendingDispatch },
      { status: homeVisitStatus.DISPATCHED, name: homeVisitStatusNames[homeVisitStatus.DISPATCHED], count: dispatched },
      { status: homeVisitStatus.ON_SITE, name: homeVisitStatusNames[homeVisitStatus.ON_SITE], count: onSite },
      { status: homeVisitStatus.COMPLETED, name: homeVisitStatusNames[homeVisitStatus.COMPLETED], count: completed },
      { status: homeVisitStatus.CANCELLED, name: homeVisitStatusNames[homeVisitStatus.CANCELLED], count: cancelled },
      { status: homeVisitStatus.EXPIRED, name: homeVisitStatusNames[homeVisitStatus.EXPIRED], count: expired }
    ],
    filters
  };
}

module.exports = {
  getCommunityHomeVisitStats,
  getStaffLoadRanking,
  getAverageHomeVisitTimeStats,
  getCannotDispatchReasonRanking,
  getSeniorReviewHomeVisitRatio,
  getMaterialCompletionSuccessRate,
  getWindowTransferDistribution,
  getHomeVisitOverview
};
