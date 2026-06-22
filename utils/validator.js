const cardTypes = require('../config/cardTypes');
const { businessTypeNames, materialNames, communityNames, agentRelationNames } = require('../config/rules');
const { cancelReasons, timeSlotNames } = require('../config/windows');

function isValidAge(age) {
  if (age === undefined || age === null || age === '') {
    return { valid: false, error: '年龄不能为空' };
  }
  const numAge = Number(age);
  if (isNaN(numAge) || !isFinite(numAge)) {
    return { valid: false, error: '年龄必须为有效数字' };
  }
  if (numAge < 0 || numAge > 150) {
    return { valid: false, error: '年龄必须在0-150周岁之间' };
  }
  if (!Number.isInteger(numAge)) {
    return { valid: false, error: '年龄必须为整数' };
  }
  return { valid: true, value: numAge };
}

function normalizeMaterials(materials) {
  if (!materials) {
    return [];
  }
  if (Array.isArray(materials)) {
    return materials.filter(m => m && m !== '').map(m => {
      if (typeof m === 'object' && m !== null) {
        const result = normalizeMaterialObject(m);
        if (m.idNumber) result.idNumber = m.idNumber;
        if (m.cardNumber) result.cardNumber = m.cardNumber;
        return result;
      }
      return { key: m, issueDate: null, expiryDate: null };
    });
  }
  if (typeof materials === 'string') {
    try {
      const parsed = JSON.parse(materials);
      return normalizeMaterials(parsed);
    } catch (e) {
      return materials.split(',').filter(m => m.trim()).map(m => ({
        key: m.trim(),
        issueDate: null,
        expiryDate: null
      }));
    }
  }
  if (typeof materials === 'object' && materials !== null) {
    return [normalizeMaterialObject(materials)];
  }
  return [];
}

function normalizeMaterialObject(obj) {
  const result = {
    key: obj.key || obj.type || '',
    issueDate: obj.issueDate || obj.date || null,
    expiryDate: obj.expiryDate || null
  };
  if (obj.idNumber) result.idNumber = obj.idNumber;
  if (obj.cardNumber) result.cardNumber = obj.cardNumber;
  return result;
}

function validatePresenceAndAgent(isPresent, agentRelation) {
  const present = isPresent === true || isPresent === 'true' || isPresent === 1 || isPresent === '1';
  const hasAgentRelation = agentRelation && agentRelation !== '' && agentRelation !== null;

  if (present && hasAgentRelation) {
    return {
      valid: false,
      error: '本人到场与代办关系字段互相矛盾：本人到场时不应填写代办关系'
    };
  }

  if (!present && !hasAgentRelation) {
    return {
      valid: true,
      needsAgent: true,
      isPresent: false
    };
  }

  return {
    valid: true,
    isPresent: present
  };
}

function isValidCardType(cardType) {
  if (!cardType || cardType === '') {
    return { valid: false, error: '卡证类型不能为空' };
  }
  if (!cardTypes[cardType]) {
    return { valid: false, error: `无效的卡证类型：${cardType}` };
  }
  return { valid: true };
}

function isValidBusinessType(businessType, cardType) {
  if (!businessType || businessType === '') {
    return { valid: false, error: '业务类型不能为空' };
  }
  if (!businessTypeNames[businessType]) {
    return { valid: false, error: `无效的业务类型：${businessType}` };
  }
  if (cardType && cardTypes[cardType]) {
    if (!cardTypes[cardType].businessTypes.includes(businessType)) {
      return {
        valid: false,
        error: `${cardTypes[cardType].name}不支持${businessTypeNames[businessType]}业务`
      };
    }
  }
  return { valid: true };
}

function isValidCommunity(communityId) {
  if (!communityId || communityId === '') {
    return { valid: true, isDefault: true };
  }
  if (communityId === 'all') {
    return { valid: true };
  }
  if (!communityNames[communityId]) {
    return { valid: false, error: `无效的社区编号：${communityId}` };
  }
  return { valid: true };
}

function isValidDate(dateStr) {
  if (!dateStr || dateStr === '') {
    return { valid: true, isDefault: true };
  }
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return { valid: false, error: `无效的日期格式：${dateStr}` };
  }
  return { valid: true, value: date.toISOString().split('T')[0] };
}

function validateMaterialDetail(material) {
  const errors = [];
  if (!material.key || material.key === '') {
    errors.push('材料key不能为空');
  } else if (!materialNames[material.key]) {
    errors.push(`未知的材料类型：${material.key}`);
  }
  if (material.issueDate) {
    const dateCheck = isValidDate(material.issueDate);
    if (!dateCheck.valid) {
      errors.push(`材料${material.key}签发日期无效：${dateCheck.error}`);
    }
  }
  if (material.expiryDate) {
    const dateCheck = isValidDate(material.expiryDate);
    if (!dateCheck.valid) {
      errors.push(`材料${material.key}有效期无效：${dateCheck.error}`);
    }
  }
  const normalized = {
    key: material.key,
    issueDate: material.issueDate || null,
    expiryDate: material.expiryDate || null
  };
  if (material.idNumber) normalized.idNumber = material.idNumber;
  if (material.cardNumber) normalized.cardNumber = material.cardNumber;
  return {
    valid: errors.length === 0,
    errors,
    normalized
  };
}

function validateAgentRelation(relation) {
  if (!relation || relation === '') {
    return { valid: true, isEmpty: true };
  }
  if (!agentRelationNames[relation]) {
    return { valid: false, error: `无效的代办关系：${relation}` };
  }
  return { valid: true };
}

function validateConsultationSubmission(body) {
  const errors = [];
  const normalized = {};

  const cardCheck = isValidCardType(body.cardType);
  if (!cardCheck.valid) errors.push(cardCheck.error);
  else normalized.cardType = body.cardType;

  const businessCheck = isValidBusinessType(body.businessType, body.cardType);
  if (!businessCheck.valid) errors.push(businessCheck.error);
  else normalized.businessType = body.businessType;

  const ageCheck = isValidAge(body.age);
  if (!ageCheck.valid) errors.push(ageCheck.error);
  else normalized.age = ageCheck.value;

  const presenceCheck = validatePresenceAndAgent(body.isPresent, body.agentRelation);
  if (!presenceCheck.valid) errors.push(presenceCheck.error);
  else normalized.isPresent = presenceCheck.isPresent;

  const agentCheck = validateAgentRelation(body.agentRelation);
  if (!agentCheck.valid) errors.push(agentCheck.error);
  else normalized.agentRelation = body.agentRelation || null;

  const communityCheck = isValidCommunity(body.communityId);
  if (!communityCheck.valid) errors.push(communityCheck.error);
  else normalized.communityId = body.communityId || 'all';

  const dateCheck = isValidDate(body.handleDate);
  if (!dateCheck.valid) errors.push(dateCheck.error);
  else normalized.handleDate = dateCheck.value || new Date().toISOString().split('T')[0];

  normalized.materials = normalizeMaterials(body.materials);
  for (const mat of normalized.materials) {
    const matCheck = validateMaterialDetail(mat);
    if (!matCheck.valid) {
      errors.push(...matCheck.errors);
    }
  }

  normalized.materialKeys = normalized.materials.map(m => m.key);

  return {
    valid: errors.length === 0,
    errors,
    normalized
  };
}

function canArchiveSuccessful(result) {
  if (!result || !result.canProceed) {
    return false;
  }
  if (result.errors && result.errors.length > 0) {
    return false;
  }
  if (result.missingMaterials && result.missingMaterials.length > 0) {
    return false;
  }
  if (result.expiredMaterials && result.expiredMaterials.length > 0) {
    return false;
  }
  if (result.agentErrors && result.agentErrors.length > 0) {
    return false;
  }
  return true;
}

function isValidCancelReason(reasonCode) {
  if (!reasonCode || reasonCode === '') {
    return { valid: true, isDefault: true, value: 'other' };
  }
  if (!cancelReasons[reasonCode]) {
    return { valid: false, error: `无效的取消原因代码：${reasonCode}` };
  }
  return { valid: true, value: reasonCode };
}

function isValidTimeSlotPreference(preference) {
  if (!preference || preference === '') {
    return { valid: true, isDefault: true, value: 'any' };
  }
  if (preference === 'any' || timeSlotNames[preference]) {
    return { valid: true, value: preference };
  }
  if (typeof preference === 'string' && /^\d{2}:\d{2}-\d{2}:\d{2}$/.test(preference)) {
    const [start, end] = preference.split('-');
    const startHour = parseInt(start.split(':')[0]);
    const endHour = parseInt(end.split(':')[0]);
    if (startHour >= 9 && endHour <= 12) {
      return { valid: true, value: preference, period: 'morning' };
    }
    if (startHour >= 13 && endHour <= 17) {
      return { valid: true, value: preference, period: 'afternoon' };
    }
  }
  return { valid: false, error: `无效的时段偏好：${preference}` };
}

function validateAppointmentSubmission(body) {
  const errors = [];
  const normalized = {};

  const cardCheck = isValidCardType(body.cardType);
  if (!cardCheck.valid) errors.push(cardCheck.error);
  else normalized.cardType = body.cardType;

  const businessCheck = isValidBusinessType(body.businessType, body.cardType);
  if (!businessCheck.valid) errors.push(businessCheck.error);
  else normalized.businessType = body.businessType;

  const ageCheck = isValidAge(body.age);
  if (!ageCheck.valid) errors.push(ageCheck.error);
  else normalized.age = ageCheck.value;

  const presenceCheck = validatePresenceAndAgent(body.isPresent, body.agentRelation);
  if (!presenceCheck.valid) errors.push(presenceCheck.error);
  else normalized.isPresent = presenceCheck.isPresent;

  const agentCheck = validateAgentRelation(body.agentRelation);
  if (!agentCheck.valid) errors.push(agentCheck.error);
  else normalized.agentRelation = body.agentRelation || null;

  const communityCheck = isValidCommunity(body.communityId);
  if (!communityCheck.valid) errors.push(communityCheck.error);
  else normalized.communityId = body.communityId || 'all';

  if (body.expectedDate !== undefined && body.expectedDate !== null && body.expectedDate !== '') {
    const dateCheck = isValidDate(body.expectedDate);
    if (!dateCheck.valid) {
      errors.push(dateCheck.error);
    } else if (dateCheck.value) {
      normalized.expectedDate = dateCheck.value;
    }
  } else {
    normalized.expectedDate = new Date().toISOString().split('T')[0];
  }

  const slotCheck = isValidTimeSlotPreference(body.preferredTimeSlot);
  if (!slotCheck.valid) errors.push(slotCheck.error);
  else normalized.preferredTimeSlot = slotCheck.value;

  normalized.materials = normalizeMaterials(body.materials);
  for (const mat of normalized.materials) {
    const matCheck = validateMaterialDetail(mat);
    if (!matCheck.valid) {
      errors.push(...matCheck.errors);
    }
  }

  normalized.materialKeys = normalized.materials.map(m => m.key);

  if (body.applicantName) {
    normalized.applicantName = String(body.applicantName).trim();
  }
  if (body.applicantContact) {
    normalized.applicantContact = String(body.applicantContact).trim();
  }
  if (body.remarks) {
    normalized.remarks = String(body.remarks).trim();
  }
  if (body.operatorId) {
    normalized.operatorId = String(body.operatorId).trim();
  }
  if (body.operatorName) {
    normalized.operatorName = String(body.operatorName).trim();
  }

  return {
    valid: errors.length === 0,
    errors,
    normalized
  };
}

function validateAppointmentCancel(body) {
  const errors = [];
  const normalized = {};

  const reasonCheck = isValidCancelReason(body.reasonCode);
  if (!reasonCheck.valid) errors.push(reasonCheck.error);
  else normalized.reasonCode = reasonCheck.value;

  if (body.reason) {
    normalized.reason = String(body.reason).trim();
  }
  if (body.remark) {
    normalized.remark = String(body.remark).trim();
  }
  if (body.operatorId) {
    normalized.operatorId = String(body.operatorId).trim();
  }
  if (body.operatorName) {
    normalized.operatorName = String(body.operatorName).trim();
  }

  return {
    valid: errors.length === 0,
    errors,
    normalized
  };
}

module.exports = {
  isValidAge,
  normalizeMaterials,
  validatePresenceAndAgent,
  isValidCardType,
  isValidBusinessType,
  isValidCommunity,
  isValidDate,
  validateMaterialDetail,
  validateAgentRelation,
  validateConsultationSubmission,
  canArchiveSuccessful,
  isValidCancelReason,
  isValidTimeSlotPreference,
  validateAppointmentSubmission,
  validateAppointmentCancel
};
