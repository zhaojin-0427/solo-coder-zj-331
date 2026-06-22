const {
  getAnnouncementsForStats,
  announcementStatus,
  announcementStatusNames,
  riskLevels
} = require('./policyAnnouncementService');
const { communityNames, businessTypeNames, materialNames } = require('../config/rules');
const cardTypes = require('../config/cardTypes');

function getCommunityAnnouncementStats(filters = {}) {
  const records = getAnnouncementsForStats(filters);
  const stats = {};

  for (const key of Object.keys(communityNames)) {
    if (key === 'all') continue;
    stats[key] = {
      communityId: key,
      communityName: communityNames[key],
      total: 0,
      draftCount: 0,
      publishedCount: 0,
      revokedCount: 0,
      archivedCount: 0
    };
  }

  for (const rec of records) {
    const communities = rec.applicableCommunities || [];
    const targetCommunities = communities.includes('all')
      ? Object.keys(stats)
      : communities.filter(c => stats[c]);

    for (const cId of targetCommunities) {
      if (!stats[cId]) continue;
      stats[cId].total++;
      if (rec.status === announcementStatus.DRAFT) stats[cId].draftCount++;
      if (rec.status === announcementStatus.PUBLISHED) stats[cId].publishedCount++;
      if (rec.status === announcementStatus.REVOKED) stats[cId].revokedCount++;
      if (rec.status === announcementStatus.ARCHIVED) stats[cId].archivedCount++;
    }
  }

  const list = Object.values(stats).sort((a, b) => b.total - a.total);
  return {
    totalCommunities: list.length,
    list,
    filters
  };
}

function getCardTypeBusinessImpactStats(filters = {}) {
  const records = getAnnouncementsForStats(filters);

  const byCardType = {};
  const byBusinessType = {};

  for (const rec of records) {
    for (const ct of (rec.applicableCardTypes || [])) {
      if (!byCardType[ct]) {
        byCardType[ct] = { cardType: ct, cardName: cardTypes[ct]?.name || ct, impactCount: 0 };
      }
      byCardType[ct].impactCount++;
    }

    for (const bt of (rec.applicableBusinessTypes || [])) {
      if (!byBusinessType[bt]) {
        byBusinessType[bt] = { businessType: bt, businessName: businessTypeNames[bt] || bt, impactCount: 0 };
      }
      byBusinessType[bt].impactCount++;
    }
  }

  return {
    byCardType: Object.values(byCardType).sort((a, b) => b.impactCount - a.impactCount),
    byBusinessType: Object.values(byBusinessType).sort((a, b) => b.impactCount - a.impactCount),
    filters
  };
}

function getPendingNotificationStats(filters = {}) {
  const fs = require('fs');
  const path = require('path');

  const announcements = getAnnouncementsForStats(filters);
  const published = announcements.filter(r => r.status === announcementStatus.PUBLISHED);

  const appointmentsPath = path.join(__dirname, '../data/appointments.json');
  const homeVisitsPath = path.join(__dirname, '../data/homeVisitOrders.json');

  let appointments = [];
  let homeVisits = [];

  try { appointments = JSON.parse(fs.readFileSync(appointmentsPath, 'utf-8')); } catch (e) { appointments = []; }
  try { homeVisits = JSON.parse(fs.readFileSync(homeVisitsPath, 'utf-8')); } catch (e) { homeVisits = []; }

  const pendingAppointments = appointments.filter(r => r.status === 'pending' || r.status === 'confirmed');
  const pendingHomeVisits = homeVisits.filter(r =>
    r.status === 'pending_dispatch' || r.status === 'dispatched' || r.status === 'on_site'
  );

  let notifyAppointmentCount = 0;
  let reviewHomeVisitCount = 0;

  for (const apt of pendingAppointments) {
    for (const ann of published) {
      const cardMatch = !ann.applicableCardTypes?.length || ann.applicableCardTypes.includes(apt.cardType);
      const bizMatch = !ann.applicableBusinessTypes?.length || ann.applicableBusinessTypes.includes(apt.businessType);
      const commMatch = !ann.applicableCommunities?.length || ann.applicableCommunities.includes('all') || ann.applicableCommunities.includes(apt.communityId);
      if (cardMatch && bizMatch && commMatch) {
        notifyAppointmentCount++;
        break;
      }
    }
  }

  for (const hv of pendingHomeVisits) {
    for (const ann of published) {
      const cardMatch = !ann.applicableCardTypes?.length || ann.applicableCardTypes.includes(hv.cardType);
      const bizMatch = !ann.applicableBusinessTypes?.length || ann.applicableBusinessTypes.includes(hv.businessType);
      const commMatch = !ann.applicableCommunities?.length || ann.applicableCommunities.includes('all') || ann.applicableCommunities.includes(hv.communityId);
      if (cardMatch && bizMatch && commMatch) {
        reviewHomeVisitCount++;
        break;
      }
    }
  }

  return {
    publishedAnnouncementCount: published.length,
    totalPendingAppointments: pendingAppointments.length,
    notifyAppointmentCount,
    totalPendingHomeVisits: pendingHomeVisits.filter(r => r.status === 'pending_dispatch').length,
    totalDispatchedHomeVisits: pendingHomeVisits.filter(r => r.status === 'dispatched' || r.status === 'on_site').length,
    reviewHomeVisitCount,
    filters
  };
}

function getMaterialChangeRanking(filters = {}) {
  const records = getAnnouncementsForStats(filters);
  const materialCount = {};

  for (const rec of records) {
    for (const mat of (rec.affectedMaterials || [])) {
      if (!materialCount[mat]) {
        materialCount[mat] = { materialKey: mat, materialName: materialNames[mat] || mat, hitCount: 0 };
      }
      materialCount[mat].hitCount++;
    }
  }

  const ranking = Object.values(materialCount).sort((a, b) => b.hitCount - a.hitCount);
  return {
    totalMaterials: ranking.length,
    ranking,
    filters
  };
}

function getHighRiskPolicyRatio(filters = {}) {
  const records = getAnnouncementsForStats(filters);
  const withAssessment = records.filter(r => r.impactAssessment);

  let highRiskCount = 0;
  let criticalRiskCount = 0;
  const byRiskLevel = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0
  };

  for (const rec of withAssessment) {
    const level = rec.impactAssessment.riskLevel?.level || 'low';
    byRiskLevel[level] = (byRiskLevel[level] || 0) + 1;
    if (level === 'high' || level === 'critical') highRiskCount++;
    if (level === 'critical') criticalRiskCount++;
  }

  const total = withAssessment.length;
  return {
    totalAnnouncements: records.length,
    assessedAnnouncements: total,
    highRiskCount,
    criticalRiskCount,
    highRiskRatio: total > 0 ? Number(((highRiskCount / total) * 100).toFixed(2)) : 0,
    criticalRiskRatio: total > 0 ? Number(((criticalRiskCount / total) * 100).toFixed(2)) : 0,
    byRiskLevel: Object.entries(byRiskLevel).map(([level, count]) => ({
      level,
      name: riskLevels[level]?.name || level,
      count,
      ratio: total > 0 ? Number(((count / total) * 100).toFixed(2)) : 0
    })),
    filters
  };
}

function getAnnouncementOverview(filters = {}) {
  const records = getAnnouncementsForStats(filters);

  const total = records.length;
  const draftCount = records.filter(r => r.status === announcementStatus.DRAFT).length;
  const publishedCount = records.filter(r => r.status === announcementStatus.PUBLISHED).length;
  const revokedCount = records.filter(r => r.status === announcementStatus.REVOKED).length;
  const archivedCount = records.filter(r => r.status === announcementStatus.ARCHIVED).length;

  const communityStats = getCommunityAnnouncementStats(filters);
  const cardBusinessStats = getCardTypeBusinessImpactStats(filters);
  const notificationStats = getPendingNotificationStats(filters);
  const materialStats = getMaterialChangeRanking(filters);
  const riskStats = getHighRiskPolicyRatio(filters);

  return {
    totalAnnouncements: total,
    draftCount,
    publishedCount,
    revokedCount,
    archivedCount,
    statusDistribution: [
      { status: announcementStatus.DRAFT, name: announcementStatusNames[announcementStatus.DRAFT], count: draftCount },
      { status: announcementStatus.PUBLISHED, name: announcementStatusNames[announcementStatus.PUBLISHED], count: publishedCount },
      { status: announcementStatus.REVOKED, name: announcementStatusNames[announcementStatus.REVOKED], count: revokedCount },
      { status: announcementStatus.ARCHIVED, name: announcementStatusNames[announcementStatus.ARCHIVED], count: archivedCount }
    ],
    communityStats: { totalCommunities: communityStats.totalCommunities, topCommunities: communityStats.list.slice(0, 5) },
    cardBusinessImpact: { topCardTypes: cardBusinessStats.byCardType.slice(0, 5), topBusinessTypes: cardBusinessStats.byBusinessType.slice(0, 5) },
    notificationStats: { notifyAppointmentCount: notificationStats.notifyAppointmentCount, reviewHomeVisitCount: notificationStats.reviewHomeVisitCount },
    materialChangeRanking: materialStats.ranking.slice(0, 10),
    riskOverview: { highRiskRatio: riskStats.highRiskRatio, criticalRiskRatio: riskStats.criticalRiskRatio, byRiskLevel: riskStats.byRiskLevel },
    filters
  };
}

module.exports = {
  getCommunityAnnouncementStats,
  getCardTypeBusinessImpactStats,
  getPendingNotificationStats,
  getMaterialChangeRanking,
  getHighRiskPolicyRatio,
  getAnnouncementOverview
};
