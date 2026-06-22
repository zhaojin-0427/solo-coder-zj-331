const { getAppointmentsForStats, cancelReasons } = require('./appointmentService');
const { appointmentStatus, appointmentStatusNames, failReasons, getCommunityWindowConfig, windowTypes } = require('../config/windows');
const { communityNames, businessTypeNames, agentRelationNames } = require('../config/rules');
const cardTypes = require('../config/cardTypes');

function getCommunityAppointmentStats(filters = {}) {
  const records = getAppointmentsForStats(filters);
  const stats = {};

  for (const key of Object.keys(communityNames)) {
    if (key === 'all') continue;
    stats[key] = {
      communityId: key,
      communityName: communityNames[key],
      total: 0,
      pendingCount: 0,
      confirmedCount: 0,
      cancelledCount: 0,
      expiredCount: 0,
      failedCount: 0,
      reviewCount: 0,
      agentCount: 0,
      successRate: 0
    };
  }

  for (const rec of records) {
    if (!stats[rec.communityId]) continue;
    const s = stats[rec.communityId];
    s.total++;
    if (rec.status === appointmentStatus.PENDING) s.pendingCount++;
    if (rec.status === appointmentStatus.CONFIRMED) s.confirmedCount++;
    if (rec.status === appointmentStatus.CANCELLED) s.cancelledCount++;
    if (rec.status === appointmentStatus.EXPIRED) s.expiredCount++;
    if (rec.status === appointmentStatus.FAILED) s.failedCount++;
    if (rec.isReviewRequired) s.reviewCount++;
    if (rec.isAgent) s.agentCount++;
  }

  for (const s of Object.values(stats)) {
    const validTotal = s.total - s.cancelledCount - s.expiredCount - s.failedCount;
    if (validTotal > 0) {
      s.successRate = Number((((s.confirmedCount + s.pendingCount) / validTotal) * 100).toFixed(2));
    }
  }

  const list = Object.values(stats).sort((a, b) => b.total - a.total);
  return {
    totalCommunities: list.length,
    list,
    filters
  };
}

function getWindowLoadRanking(filters = {}) {
  const records = getAppointmentsForStats(filters);
  const loadMap = {};

  for (const rec of records) {
    const winId = rec.assignedWindowId;
    if (!winId) continue;
    if (!loadMap[winId]) {
      loadMap[winId] = {
        windowId: winId,
        windowType: rec.assignedWindowType,
        windowTypeName: rec.assignedWindowTypeName,
        communityId: rec.communityId,
        communityName: rec.communityName,
        totalAppointments: 0,
        confirmedAppointments: 0,
        cancelledAppointments: 0,
        totalBusinessMinutes: 0,
        avgBusinessMinutes: 0
      };
    }
    const entry = loadMap[winId];
    entry.totalAppointments++;
    if (rec.status === appointmentStatus.CONFIRMED || rec.status === appointmentStatus.PENDING) {
      entry.confirmedAppointments++;
      entry.totalBusinessMinutes += rec.businessMinutes || 0;
    }
    if (rec.status === appointmentStatus.CANCELLED) entry.cancelledAppointments++;
  }

  for (const entry of Object.values(loadMap)) {
    if (entry.confirmedAppointments > 0) {
      entry.avgBusinessMinutes = Number((entry.totalBusinessMinutes / entry.confirmedAppointments).toFixed(1));
    }
  }

  const list = Object.values(loadMap).sort((a, b) => b.confirmedAppointments - a.confirmedAppointments);
  return {
    totalWindows: list.length,
    ranking: list,
    filters
  };
}

function getAverageWaitTimeStats(filters = {}) {
  const records = getAppointmentsForStats(filters);
  const validRecords = records.filter(r =>
    r.status === appointmentStatus.CONFIRMED || r.status === appointmentStatus.PENDING);

  const byBusinessType = {};
  const byCardType = {};
  const byCommunity = {};

  let totalWait = 0;
  let totalBusiness = 0;
  let count = 0;

  for (const rec of validRecords) {
    const wait = rec.estimatedWaitMinutes || 0;
    const bus = rec.businessMinutes || 0;
    totalWait += wait;
    totalBusiness += bus;
    count++;

    const btKey = rec.businessType;
    if (!byBusinessType[btKey]) {
      byBusinessType[btKey] = { businessType: btKey, businessName: businessTypeNames[btKey] || btKey, totalWait: 0, totalBusiness: 0, count: 0 };
    }
    byBusinessType[btKey].totalWait += wait;
    byBusinessType[btKey].totalBusiness += bus;
    byBusinessType[btKey].count++;

    const ctKey = rec.cardType;
    if (!byCardType[ctKey]) {
      byCardType[ctKey] = { cardType: ctKey, cardName: cardTypes[ctKey]?.name || ctKey, totalWait: 0, totalBusiness: 0, count: 0 };
    }
    byCardType[ctKey].totalWait += wait;
    byCardType[ctKey].totalBusiness += bus;
    byCardType[ctKey].count++;

    const cKey = rec.communityId;
    if (!byCommunity[cKey]) {
      byCommunity[cKey] = { communityId: cKey, communityName: communityNames[cKey] || cKey, totalWait: 0, totalBusiness: 0, count: 0 };
    }
    byCommunity[cKey].totalWait += wait;
    byCommunity[cKey].totalBusiness += bus;
    byCommunity[cKey].count++;
  }

  const finalize = obj => Object.values(obj).map(v => ({
    ...v,
    avgWaitMinutes: v.count > 0 ? Number((v.totalWait / v.count).toFixed(1)) : 0,
    avgBusinessMinutes: v.count > 0 ? Number((v.totalBusiness / v.count).toFixed(1)) : 0,
    avgTotalMinutes: v.count > 0 ? Number(((v.totalWait + v.totalBusiness) / v.count).toFixed(1)) : 0
  })).sort((a, b) => b.count - a.count);

  return {
    overall: {
      totalRecords: validRecords.length,
      avgWaitMinutes: count > 0 ? Number((totalWait / count).toFixed(1)) : 0,
      avgBusinessMinutes: count > 0 ? Number((totalBusiness / count).toFixed(1)) : 0,
      avgTotalMinutes: count > 0 ? Number(((totalWait + totalBusiness) / count).toFixed(1)) : 0
    },
    byBusinessType: finalize(byBusinessType),
    byCardType: finalize(byCardType),
    byCommunity: finalize(byCommunity),
    filters
  };
}

function getCannotReserveReasonRanking(filters = {}) {
  const records = getAppointmentsForStats(filters);
  const cancelledRecords = records.filter(r => r.status === appointmentStatus.CANCELLED);
  const failedRecords = records.filter(r => r.status === appointmentStatus.FAILED);

  const reasonCount = {};

  for (const rec of cancelledRecords) {
    const code = rec.cancelReasonCode || 'other';
    if (!reasonCount[code]) {
      reasonCount[code] = {
        code,
        name: cancelReasons[code] || code,
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
          name: failReasons[code] || code,
          category: 'failed',
          count: 0
        };
      }
      reasonCount[code].count++;
    }
  }

  const ranking = Object.values(reasonCount).sort((a, b) => b.count - a.count);

  const expiredRecords = records.filter(r => r.status === appointmentStatus.EXPIRED);

  return {
    totalCancelled: cancelledRecords.length,
    totalExpired: expiredRecords.length,
    totalFailed: failedRecords.length,
    totalUnsuccessful: cancelledRecords.length + expiredRecords.length + failedRecords.length,
    ranking,
    filters
  };
}

function getReviewAppointmentRatio(filters = {}) {
  const records = getAppointmentsForStats(filters);
  const totalRecords = records.filter(r =>
    r.status !== appointmentStatus.CANCELLED);

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

  return {
    totalAppointments: totalRecords.length,
    reviewAppointments: reviewRecords.length,
    nonReviewAppointments: nonReviewRecords.length,
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
    filters
  };
}

function getAgentAppointmentSuccessRate(filters = {}) {
  const records = getAppointmentsForStats(filters);

  const agentRecords = records.filter(r => r.isAgent === true);
  const selfRecords = records.filter(r => r.isAgent === false);

  const byRelation = {};
  for (const rec of agentRecords) {
    const rel = rec.agentRelation || 'unknown';
    if (!byRelation[rel]) {
      byRelation[rel] = {
        relation: rel,
        relationName: agentRelationNames[rel] || rel,
        total: 0,
        success: 0,
        fail: 0
      };
    }
    byRelation[rel].total++;
    if (rec.status === appointmentStatus.CONFIRMED || rec.status === appointmentStatus.PENDING) {
      byRelation[rel].success++;
    } else {
      byRelation[rel].fail++;
    }
  }

  const byBusinessType = {};
  for (const rec of agentRecords) {
    const bt = rec.businessType;
    if (!byBusinessType[bt]) {
      byBusinessType[bt] = {
        businessType: bt,
        businessName: businessTypeNames[bt] || bt,
        total: 0,
        success: 0,
        fail: 0
      };
    }
    byBusinessType[bt].total++;
    if (rec.status === appointmentStatus.CONFIRMED || rec.status === appointmentStatus.PENDING) {
      byBusinessType[bt].success++;
    } else {
      byBusinessType[bt].fail++;
    }
  }

  const calcRate = (total, success) => total > 0 ? Number((success / total * 100).toFixed(2)) : 0;
  const countSuccess = list => list.filter(r => r.status === appointmentStatus.CONFIRMED || r.status === appointmentStatus.PENDING).length;
  const countFail = list => list.filter(r => r.status === appointmentStatus.CANCELLED || r.status === appointmentStatus.EXPIRED).length;

  return {
    agentTotal: agentRecords.length,
    agentSuccess: countSuccess(agentRecords),
    agentFail: countFail(agentRecords),
    agentSuccessRate: calcRate(agentRecords.length, countSuccess(agentRecords)),
    selfTotal: selfRecords.length,
    selfSuccess: countSuccess(selfRecords),
    selfFail: countFail(selfRecords),
    selfSuccessRate: calcRate(selfRecords.length, countSuccess(selfRecords)),
    byRelation: Object.values(byRelation).map(v => ({
      ...v,
      successRate: calcRate(v.total, v.success)
    })).sort((a, b) => b.total - a.total),
    byBusinessType: Object.values(byBusinessType).map(v => ({
      ...v,
      successRate: calcRate(v.total, v.success)
    })).sort((a, b) => b.total - a.total),
    filters
  };
}

function getAppointmentOverview(filters = {}) {
  const records = getAppointmentsForStats(filters);

  const total = records.length;
  const pending = records.filter(r => r.status === appointmentStatus.PENDING).length;
  const confirmed = records.filter(r => r.status === appointmentStatus.CONFIRMED).length;
  const cancelled = records.filter(r => r.status === appointmentStatus.CANCELLED).length;
  const expired = records.filter(r => r.status === appointmentStatus.EXPIRED).length;
  const failed = records.filter(r => r.status === appointmentStatus.FAILED).length;

  const reviewCount = records.filter(r => r.isReviewRequired === true).length;
  const agentCount = records.filter(r => r.isAgent === true).length;

  const validTotal = total - cancelled - expired - failed;
  const successRate = validTotal > 0
    ? Number((((confirmed + pending) / validTotal) * 100).toFixed(2))
    : 0;

  const waitStats = getAverageWaitTimeStats(filters);
  const communityStats = getCommunityAppointmentStats(filters);

  return {
    totalAppointments: total,
    pendingCount: pending,
    confirmedCount: confirmed,
    cancelledCount: cancelled,
    expiredCount: expired,
    failedCount: failed,
    successRate,
    reviewCount,
    reviewRatio: total > 0 ? Number(((reviewCount / total) * 100).toFixed(2)) : 0,
    agentCount,
    agentRatio: total > 0 ? Number(((agentCount / total) * 100).toFixed(2)) : 0,
    avgWaitMinutes: waitStats.overall.avgWaitMinutes,
    avgBusinessMinutes: waitStats.overall.avgBusinessMinutes,
    topCommunities: communityStats.list.slice(0, 5),
    statusDistribution: [
      { status: appointmentStatus.PENDING, name: appointmentStatusNames[appointmentStatus.PENDING], count: pending },
      { status: appointmentStatus.CONFIRMED, name: appointmentStatusNames[appointmentStatus.CONFIRMED], count: confirmed },
      { status: appointmentStatus.CANCELLED, name: appointmentStatusNames[appointmentStatus.CANCELLED], count: cancelled },
      { status: appointmentStatus.EXPIRED, name: appointmentStatusNames[appointmentStatus.EXPIRED], count: expired },
      { status: appointmentStatus.FAILED, name: appointmentStatusNames[appointmentStatus.FAILED], count: failed }
    ],
    filters
  };
}

module.exports = {
  getCommunityAppointmentStats,
  getWindowLoadRanking,
  getAverageWaitTimeStats,
  getCannotReserveReasonRanking,
  getReviewAppointmentRatio,
  getAgentAppointmentSuccessRate,
  getAppointmentOverview
};
