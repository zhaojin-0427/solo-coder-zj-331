const cardTypes = {
  bus_card: {
    id: 'bus_card',
    name: '公交卡',
    description: '老年人公交优惠卡',
    minAge: 65,
    businessTypes: ['apply', 'reissue', 'report_loss', 'annual_review']
  },
  senior_card: {
    id: 'senior_card',
    name: '老年卡',
    description: '老年人优待证',
    minAge: 60,
    businessTypes: ['apply', 'reissue', 'report_loss', 'annual_review']
  },
  medical_card: {
    id: 'medical_card',
    name: '就诊卡',
    description: '医院就诊一卡通',
    minAge: 0,
    businessTypes: ['apply', 'reissue', 'report_loss']
  }
};

module.exports = cardTypes;
