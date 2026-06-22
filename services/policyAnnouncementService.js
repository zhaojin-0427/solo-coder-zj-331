const fs = require('fs');
const path = require('path');

const { communityNames, businessTypeNames, materialNames, agentRelationNames, rules, getAllRuleVersions } = require('../config/rules');
const cardTypes = require('../config/cardTypes');
const { homeVisitStatus } = require('./homeVisitService');

const DATA_FILE = path.join(__dirname, '../data/policyAnnouncements.json');
const HISTORY_FILE = path.join(__dirname, '../data/history.json');
const APPOINTMENTS_FILE = path.join(__dirname, '../data/appointments.json');
const HOME_VISIT_FILE = path.join(__dirname, '../data/homeVisitOrders.json');

const announcementStatus = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  REVOKED: 'revoked',
  ARCHIVED: 'archived'
};

const announcementStatusNames = {
  draft: '草稿',
  published: '已发布',
  revoked: '已撤回',
  archived: '已归档'
};

const riskLevels = {
  low: { level: 'low', name: '低风险', score: 1 },
  medium: { level: 'medium', name: '中风险', score: 2 },
  high: { level: 'high', name: '高风险', score: 3 },
  critical: { level: 'critical', name: '极高风险', score: 4 }
};

let cache = null;

function ensureDataFile() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
  }
}

function loadAnnouncements() {
  if (cache) return cache;
  ensureDataFile();
  try {
    const content = fs.readFileSync(DATA_FILE, 'utf-8');
    cache = JSON.parse(content);
  } catch (e) {
    cache = [];
  }
  return cache;
}

function saveAnnouncements(records) {
  cache = records;
  fs.writeFileSync(DATA_FILE, JSON.stringify(records, null, 2));
}

function loadJsonFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    return [];
  }
}

function generateId() {
  return 'PA' + Date.now().toString() + Math.random().toString(36).slice(2, 8).toUpperCase();
}

function createAnnouncement(params) {
  const records = loadAnnouncements();
  const now = new Date().toISOString();
  const today = now.split('T')[0];

  const announcement = {
    id: generateId(),
    title: params.title,
    applicableCardTypes: params.applicableCardTypes || [],
    applicableBusinessTypes: params.applicableBusinessTypes || [],
    applicableCommunities: params.applicableCommunities || [],
    effectiveDate: params.effectiveDate,
    expiryDate: params.expiryDate || null,
    changeSummary: params.changeSummary || '',
    affectedMaterials: params.affectedMaterials || [],
    affectedAgeThresholds: params.affectedAgeThresholds || null,
    affectedAgentRestrictions: params.affectedAgentRestrictions || null,
    operationGuide: params.operationGuide || '',
    status: announcementStatus.DRAFT,
    statusName: announcementStatusNames[announcementStatus.DRAFT],
    parentAnnouncementId: params.parentAnnouncementId || null,
    version: params.parentAnnouncementId ? deriveNextVersion(records, params.parentAnnouncementId) : 'v1.0',
    statusHistory: [
      { status: announcementStatus.DRAFT, time: now, operatorId: params.operatorId || 'system', operatorName: params.operatorName || '系统', remark: '创建草稿' }
    ],
    impactAssessment: null,
    publishedAt: null,
    publishedBy: null,
    revokedAt: null,
    revokedBy: null,
    archivedAt: null,
    archivedBy: null,
    operatorId: params.operatorId || 'system',
    operatorName: params.operatorName || '系统',
    remarks: params.remarks || null,
    createdAt: now,
    updatedAt: now
  };

  records.unshift(announcement);
  saveAnnouncements(records);

  return { success: true, announcement };
}

function deriveNextVersion(records, parentId) {
  const siblings = records.filter(r => r.parentAnnouncementId === parentId || r.id === parentId);
  let maxMajor = 0;
  let maxMinor = 0;
  for (const s of siblings) {
    const match = s.version?.match(/v(\d+)\.(\d+)/);
    if (match) {
      const major = parseInt(match[1]);
      const minor = parseInt(match[2]);
      if (major > maxMajor || (major === maxMajor && minor > maxMinor)) {
        maxMajor = major;
        maxMinor = minor;
      }
    }
  }
  return `v${maxMajor + 1}.0`;
}

function getAnnouncements(page = 1, pageSize = 20, filters = {}) {
  let records = loadAnnouncements();

  if (filters.status) records = records.filter(r => r.status === filters.status);
  if (filters.applicableCardType) records = records.filter(r => r.applicableCardTypes && r.applicableCardTypes.includes(filters.applicableCardType));
  if (filters.applicableBusinessType) records = records.filter(r => r.applicableBusinessTypes && r.applicableBusinessTypes.includes(filters.applicableBusinessType));
  if (filters.applicableCommunity) records = records.filter(r => r.applicableCommunities && (r.applicableCommunities.includes(filters.applicableCommunity) || r.applicableCommunities.includes('all')));
  if (filters.effectiveStartDate) records = records.filter(r => r.effectiveDate >= filters.effectiveStartDate);
  if (filters.effectiveEndDate) records = records.filter(r => r.effectiveDate <= filters.effectiveEndDate);
  if (filters.keyword) {
    const kw = filters.keyword.toLowerCase();
    records = records.filter(r => (r.title || '').toLowerCase().includes(kw) || (r.changeSummary || '').toLowerCase().includes(kw));
  }
  if (filters.parentAnnouncementId) records = records.filter(r => r.parentAnnouncementId === filters.parentAnnouncementId);

  const total = records.length;
  const start = (page - 1) * pageSize;
  const list = records.slice(start, start + pageSize);

  return { list, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

function getAnnouncementById(id) {
  const records = loadAnnouncements();
  return records.find(r => r.id === id) || null;
}

function getAnnouncementsForStats(filters = {}) {
  let records = loadAnnouncements();
  if (filters.status) records = records.filter(r => r.status === filters.status);
  if (filters.applicableCardType) records = records.filter(r => r.applicableCardTypes && r.applicableCardTypes.includes(filters.applicableCardType));
  if (filters.applicableBusinessType) records = records.filter(r => r.applicableBusinessTypes && r.applicableBusinessTypes.includes(filters.applicableBusinessType));
  if (filters.applicableCommunity) records = records.filter(r => r.applicableCommunities && (r.applicableCommunities.includes(filters.applicableCommunity) || r.applicableCommunities.includes('all')));
  if (filters.effectiveStartDate) records = records.filter(r => r.effectiveDate >= filters.effectiveStartDate);
  if (filters.effectiveEndDate) records = records.filter(r => r.effectiveDate <= filters.effectiveEndDate);
  return records;
}

function publishAnnouncement(id, operatorId = 'system', operatorName = '系统') {
  const records = loadAnnouncements();
  const announcement = records.find(r => r.id === id);

  if (!announcement) return { success: false, reason: '公告不存在' };
  if (announcement.status !== announcementStatus.DRAFT) {
    return { success: false, reason: `当前状态为${announcementStatusNames[announcement.status]}，只有草稿状态可以发布` };
  }

  const assessment = performImpactAssessment(announcement);

  announcement.status = announcementStatus.PUBLISHED;
  announcement.statusName = announcementStatusNames[announcementStatus.PUBLISHED];
  announcement.publishedAt = new Date().toISOString();
  announcement.publishedBy = { operatorId, operatorName };
  announcement.impactAssessment = assessment;
  announcement.statusHistory.push({
    status: announcementStatus.PUBLISHED,
    time: new Date().toISOString(),
    operatorId,
    operatorName,
    remark: '发布公告'
  });
  announcement.updatedAt = new Date().toISOString();

  saveAnnouncements(records);
  return { success: true, announcement };
}

function revokeAnnouncement(id, reason, operatorId = 'system', operatorName = '系统') {
  const records = loadAnnouncements();
  const announcement = records.find(r => r.id === id);

  if (!announcement) return { success: false, reason: '公告不存在' };
  if (announcement.status !== announcementStatus.PUBLISHED) {
    return { success: false, reason: `当前状态为${announcementStatusNames[announcement.status]}，只有已发布状态可以撤回` };
  }

  announcement.status = announcementStatus.REVOKED;
  announcement.statusName = announcementStatusNames[announcementStatus.REVOKED];
  announcement.revokedAt = new Date().toISOString();
  announcement.revokedBy = { operatorId, operatorName };
  announcement.statusHistory.push({
    status: announcementStatus.REVOKED,
    time: new Date().toISOString(),
    operatorId,
    operatorName,
    remark: reason || '撤回公告'
  });
  announcement.updatedAt = new Date().toISOString();

  saveAnnouncements(records);
  return { success: true, announcement };
}

function archiveAnnouncement(id, operatorId = 'system', operatorName = '系统') {
  const records = loadAnnouncements();
  const announcement = records.find(r => r.id === id);

  if (!announcement) return { success: false, reason: '公告不存在' };
  if (announcement.status !== announcementStatus.REVOKED && announcement.status !== announcementStatus.PUBLISHED) {
    return { success: false, reason: `当前状态为${announcementStatusNames[announcement.status]}，只有已发布或已撤回状态可以归档` };
  }

  announcement.status = announcementStatus.ARCHIVED;
  announcement.statusName = announcementStatusNames[announcementStatus.ARCHIVED];
  announcement.archivedAt = new Date().toISOString();
  announcement.archivedBy = { operatorId, operatorName };
  announcement.statusHistory.push({
    status: announcementStatus.ARCHIVED,
    time: new Date().toISOString(),
    operatorId,
    operatorName,
    remark: '归档公告'
  });
  announcement.updatedAt = new Date().toISOString();

  saveAnnouncements(records);
  return { success: true, announcement };
}

function performImpactAssessment(announcement) {
  const {
    applicableCardTypes = [],
    applicableBusinessTypes = [],
    applicableCommunities = [],
    effectiveDate,
    affectedMaterials = [],
    affectedAgeThresholds,
    affectedAgentRestrictions
  } = announcement;

  const communities = applicableCommunities.includes('all')
    ? Object.keys(communityNames).filter(k => k !== 'all')
    : applicableCommunities;

  const affectedRuleVersions = identifyAffectedRuleVersions(applicableCardTypes, applicableBusinessTypes, communities, affectedMaterials, affectedAgeThresholds, affectedAgentRestrictions);
  const affectedConsultations = identifyAffectedConsultations(applicableCardTypes, applicableBusinessTypes, communities, effectiveDate, affectedMaterials, affectedAgeThresholds, affectedAgentRestrictions);
  const affectedAppointments = identifyAffectedAppointments(applicableCardTypes, applicableBusinessTypes, communities, effectiveDate, affectedMaterials, affectedAgeThresholds, affectedAgentRestrictions);
  const affectedHomeVisits = identifyAffectedHomeVisits(applicableCardTypes, applicableBusinessTypes, communities, effectiveDate, affectedMaterials, affectedAgeThresholds, affectedAgentRestrictions);

  const totalAffectedRecords = affectedConsultations.total + affectedAppointments.total + affectedHomeVisits.total;
  const totalNotificationTargets = affectedAppointments.pendingCount + affectedHomeVisits.pendingDispatchCount + affectedHomeVisits.dispatchedCount;

  const reviewRecords = [
    ...affectedConsultations.records.slice(0, 10).map(r => ({ type: 'consultation', id: r.id, cardType: r.cardType, businessType: r.businessType, communityId: r.communityId, handleDate: r.handleDate || r.createdAt })),
    ...affectedAppointments.records.slice(0, 10).map(r => ({ type: 'appointment', id: r.id, cardType: r.cardType, businessType: r.businessType, communityId: r.communityId, expectedDate: r.expectedDate })),
    ...affectedHomeVisits.records.slice(0, 10).map(r => ({ type: 'home_visit', id: r.id, cardType: r.cardType, businessType: r.businessType, communityId: r.communityId, expectedDate: r.expectedDate }))
  ];

  const suggestedActions = generateSuggestedActions(affectedRuleVersions, affectedConsultations, affectedAppointments, affectedHomeVisits);
  const riskLevel = calculateRiskLevel(affectedRuleVersions, totalAffectedRecords, totalNotificationTargets, affectedMaterials);

  return {
    affectedRuleVersions,
    affectedConsultations: { total: affectedConsultations.total, sampleRecords: affectedConsultations.records.slice(0, 5) },
    affectedAppointments: { total: affectedAppointments.total, pendingCount: affectedAppointments.pendingCount, sampleRecords: affectedAppointments.records.slice(0, 5) },
    affectedHomeVisits: { total: affectedHomeVisits.total, pendingDispatchCount: affectedHomeVisits.pendingDispatchCount, dispatchedCount: affectedHomeVisits.dispatchedCount, sampleRecords: affectedHomeVisits.records.slice(0, 5) },
    impactScope: {
      totalAffectedRecords,
      totalNotificationTargets,
      affectedCommunityCount: communities.length,
      affectedCardTypeCount: applicableCardTypes.length,
      affectedBusinessTypeCount: applicableBusinessTypes.length
    },
    reviewRecords,
    suggestedActions,
    riskLevel,
    assessedAt: new Date().toISOString()
  };
}

function identifyAffectedRuleVersions(cardTypes, businessTypes, communities, materials, ageThresholds, agentRestrictions) {
  const affected = [];

  for (const bt of businessTypes) {
    if (!rules[bt]) continue;
    const versions = rules[bt].versions || [];
    for (const ver of versions) {
      const appliesToCommunity = ver.applicableCommunities.includes('all') || communities.some(c => ver.applicableCommunities.includes(c));
      if (!appliesToCommunity) continue;

      const reasons = [];
      let isAffected = false;

      for (const ct of cardTypes) {
        if (!ver[ct]) continue;
        const cardRule = ver[ct];

        if (materials.length > 0) {
          const ruleMaterials = cardRule.requiredMaterials || [];
          const agentMaterials = cardRule.agentRequiredMaterials || [];
          const allRuleMaterials = [...ruleMaterials, ...agentMaterials];
          const overlap = materials.filter(m => allRuleMaterials.includes(m));
          if (overlap.length > 0) {
            isAffected = true;
            reasons.push(`卡证${cardTypes[ct]?.name || ct}涉及材料变更：${overlap.map(m => materialNames[m] || m).join('、')}`);
          }
        }

        if (ageThresholds) {
          if (ver.seniorReviewRules && ageThresholds.newThreshold !== undefined) {
            const currentThreshold = ver.seniorReviewRules.ageThreshold;
            if (ageThresholds.newThreshold !== currentThreshold) {
              isAffected = true;
              reasons.push(`卡证${cardTypes[ct]?.name || ct}年龄门槛可能变更（当前${currentThreshold}岁）`);
            }
          }
          if (cardRule.ageRequirement !== undefined && ageThresholds.newAgeRequirement !== undefined) {
            if (ageThresholds.newAgeRequirement !== cardRule.ageRequirement) {
              isAffected = true;
              reasons.push(`卡证${cardTypes[ct]?.name || ct}年龄要求可能变更（当前${cardRule.ageRequirement}岁）`);
            }
          }
        }

        if (agentRestrictions) {
          if (cardRule.allowedAgents && agentRestrictions.newAllowedAgents) {
            const removed = cardRule.allowedAgents.filter(a => !agentRestrictions.newAllowedAgents.includes(a));
            if (removed.length > 0) {
              isAffected = true;
              reasons.push(`卡证${cardTypes[ct]?.name || ct}代办限制可能变更（移除：${removed.map(a => agentRelationNames[a] || a).join('、')}）`);
            }
          }
          if (cardRule.mustBePresent !== undefined && agentRestrictions.newMustBePresent !== undefined) {
            if (agentRestrictions.newMustBePresent !== cardRule.mustBePresent) {
              isAffected = true;
              reasons.push(`卡证${cardTypes[ct]?.name || ct}本人到场要求可能变更`);
            }
          }
        }
      }

      if (isAffected || (materials.length === 0 && !ageThresholds && !agentRestrictions)) {
        affected.push({
          businessType: bt,
          businessName: businessTypeNames[bt] || bt,
          version: ver.version,
          effectiveDate: ver.effectiveDate,
          applicableCommunities: ver.applicableCommunities,
          reasons: reasons.length > 0 ? reasons : ['该业务规则版本可能受政策变更影响'],
          isDirectlyAffected: isAffected
        });
      }
    }
  }

  return affected;
}

function identifyAffectedConsultations(cardTypes, businessTypes, communities, effectiveDate, materials, ageThresholds, agentRestrictions) {
  const consultations = loadJsonFile(HISTORY_FILE);
  let filtered = consultations;

  if (cardTypes.length > 0) filtered = filtered.filter(r => cardTypes.includes(r.cardType));
  if (businessTypes.length > 0) filtered = filtered.filter(r => businessTypes.includes(r.businessType));
  if (communities.length > 0) filtered = filtered.filter(r => communities.includes(r.communityId));

  const records = filtered.map(r => ({
    id: r.id,
    cardType: r.cardType,
    businessType: r.businessType,
    communityId: r.communityId,
    handleDate: r.handleDate,
    createdAt: r.createdAt,
    canProceedSuccessfully: r.canProceedSuccessfully,
    matchReason: determineMatchReason(r, materials, ageThresholds, agentRestrictions)
  }));

  return { total: records.length, records };
}

function identifyAffectedAppointments(cardTypes, businessTypes, communities, effectiveDate, materials, ageThresholds, agentRestrictions) {
  const appointments = loadJsonFile(APPOINTMENTS_FILE);
  let filtered = appointments;

  if (cardTypes.length > 0) filtered = filtered.filter(r => cardTypes.includes(r.cardType));
  if (businessTypes.length > 0) filtered = filtered.filter(r => businessTypes.includes(r.businessType));
  if (communities.length > 0) filtered = filtered.filter(r => communities.includes(r.communityId));

  const pendingStatuses = ['pending', 'confirmed'];
  const pendingCount = filtered.filter(r => pendingStatuses.includes(r.status)).length;

  const records = filtered.map(r => ({
    id: r.id,
    cardType: r.cardType,
    businessType: r.businessType,
    communityId: r.communityId,
    expectedDate: r.expectedDate,
    status: r.status,
    applicantName: r.applicantName,
    matchReason: determineMatchReason(r, materials, ageThresholds, agentRestrictions)
  }));

  return { total: records.length, pendingCount, records };
}

function identifyAffectedHomeVisits(cardTypes, businessTypes, communities, effectiveDate, materials, ageThresholds, agentRestrictions) {
  const homeVisits = loadJsonFile(HOME_VISIT_FILE);
  let filtered = homeVisits;

  if (cardTypes.length > 0) filtered = filtered.filter(r => cardTypes.includes(r.cardType));
  if (businessTypes.length > 0) filtered = filtered.filter(r => businessTypes.includes(r.businessType));
  if (communities.length > 0) filtered = filtered.filter(r => communities.includes(r.communityId));

  const pendingDispatchCount = filtered.filter(r => r.status === homeVisitStatus.PENDING_DISPATCH).length;
  const dispatchedCount = filtered.filter(r => r.status === homeVisitStatus.DISPATCHED || r.status === homeVisitStatus.ON_SITE).length;

  const records = filtered.map(r => ({
    id: r.id,
    cardType: r.cardType,
    businessType: r.businessType,
    communityId: r.communityId,
    expectedDate: r.expectedDate,
    status: r.status,
    applicantName: r.applicantName,
    assignedStaffName: r.assignedStaffName,
    matchReason: determineMatchReason(r, materials, ageThresholds, agentRestrictions)
  }));

  return { total: records.length, pendingDispatchCount, dispatchedCount, records };
}

function determineMatchReason(record, materials, ageThresholds, agentRestrictions) {
  const reasons = [];
  if (materials && materials.length > 0) {
    const recordMaterials = record.materialKeys || record.materials?.map(m => m.key) || [];
    const overlap = materials.filter(m => recordMaterials.includes(m));
    if (overlap.length > 0) {
      reasons.push(`涉及材料：${overlap.map(m => materialNames[m] || m).join('、')}`);
    }
  }
  if (ageThresholds) {
    if (ageThresholds.newAgeRequirement !== undefined && record.age !== undefined) {
      reasons.push(`涉及年龄门槛（当前${record.age}岁）`);
    }
  }
  if (agentRestrictions) {
    if (record.agentRelation) {
      reasons.push('涉及代办限制');
    }
  }
  return reasons.length > 0 ? reasons.join('；') : '卡证/业务类型匹配';
}

function generateSuggestedActions(ruleVersions, consultations, appointments, homeVisits) {
  const actions = [];

  if (ruleVersions.length > 0) {
    actions.push({
      type: 'rule_update',
      priority: 'high',
      description: `需更新${ruleVersions.length}个规则版本以匹配新政策`,
      details: ruleVersions.map(rv => `${businessTypeNames[rv.businessType] || rv.businessType} ${rv.version}`).join('、')
    });
  }

  if (appointments.pendingCount > 0) {
    actions.push({
      type: 'notify_appointments',
      priority: 'high',
      description: `需通知${appointments.pendingCount}条未完成预约的相关变更`,
      details: `涉及${appointments.pendingCount}条待确认/已确认预约`
    });
  }

  if (homeVisits.pendingDispatchCount > 0 || homeVisits.dispatchedCount > 0) {
    const total = homeVisits.pendingDispatchCount + homeVisits.dispatchedCount;
    actions.push({
      type: 'review_home_visits',
      priority: 'high',
      description: `需复核${total}条上门工单（待派单${homeVisits.pendingDispatchCount}条、已派单/上门中${homeVisits.dispatchedCount}条）`,
      details: `政策变更可能影响上门工单的材料要求和办理流程`
    });
  }

  if (consultations.total > 0) {
    actions.push({
      type: 'review_consultations',
      priority: 'medium',
      description: `需复核${consultations.total}条历史咨询记录`,
      details: `历史咨询中涉及的政策口径可能需要更新`
    });
  }

  return actions;
}

function calculateRiskLevel(ruleVersions, totalAffectedRecords, totalNotificationTargets, affectedMaterials) {
  let score = 0;

  if (totalAffectedRecords > 100) score += 4;
  else if (totalAffectedRecords > 50) score += 3;
  else if (totalAffectedRecords > 20) score += 2;
  else if (totalAffectedRecords > 0) score += 1;

  if (totalNotificationTargets > 20) score += 2;
  else if (totalNotificationTargets > 5) score += 1;

  if (ruleVersions.length > 3) score += 2;
  else if (ruleVersions.length > 1) score += 1;

  if (affectedMaterials && affectedMaterials.length > 3) score += 1;

  if (score <= 2) return { ...riskLevels.low };
  if (score <= 4) return { ...riskLevels.medium };
  if (score <= 6) return { ...riskLevels.high };
  return { ...riskLevels.critical };
}

function getImpactAssessment(id) {
  const announcement = getAnnouncementById(id);
  if (!announcement) return { success: false, reason: '公告不存在' };

  const assessment = performImpactAssessment(announcement);
  return { success: true, assessment };
}

function clearAllAnnouncements() {
  saveAnnouncements([]);
  return true;
}

module.exports = {
  announcementStatus,
  announcementStatusNames,
  riskLevels,
  createAnnouncement,
  getAnnouncements,
  getAnnouncementById,
  getAnnouncementsForStats,
  publishAnnouncement,
  revokeAnnouncement,
  archiveAnnouncement,
  getImpactAssessment,
  performImpactAssessment,
  clearAllAnnouncements
};
