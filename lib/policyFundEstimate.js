// lib/policyFundEstimate.js
// 고객 대시보드의 "기관별 예상 가능 한도"에 쓰는 추정 계산.
// app/api/chat/route.js의 AI 상담 시스템 프롬프트에 정리된 실제 심사 기준(소진공/신용보증재단/신보/기보)을
// 그대로 반영했습니다. revenue_amount는 DB에 "만원" 단위로 저장되어 있습니다.

function industryMatches(industry, keywords) {
  const text = industry || '';
  return keywords.some((k) => text.includes(k));
}

const WHOLESALE_KEYWORDS = ['도소매', '유통', '판매', '소매', '도매'];
const MANUFACTURING_KEYWORDS = ['제조'];
const FOOD_SERVICE_KEYWORDS = ['음식', '요식', '카페', '외식', '서비스업'];

// customer: DB row (snake_case 필드), revenueAmount 단위는 만원
export function estimateInstitutionLimits(customer) {
  const revenue = Number(customer.revenue_amount) || 0; // 만원
  const industry = customer.industry || '';

  const isFoodOrService = industryMatches(industry, FOOD_SERVICE_KEYWORDS);
  const isWholesale = industryMatches(industry, WHOLESALE_KEYWORDS);
  const isManufacturing = industryMatches(industry, MANUFACTURING_KEYWORDS);

  const results = [];

  // 소진공 직접대출: 기본 총한도 1억(10,000만원), 혁신형/도약형은 별도 2억(20,000만원)
  results.push({
    key: 'sojinkong',
    name: '소진공 직접대출',
    limit: 10000,
    note: '기본 총한도 (혁신형·도약형 조건 충족 시 2억 별도 적용)',
  });

  // 신용보증재단: 매출 5억(50,000만원) 미만 소상공인 대부분 해당, 한도 1억
  if (revenue < 50000) {
    results.push({
      key: 'sinyong_bojeung',
      name: '신용보증재단',
      limit: 10000,
      note: '매출 5억 미만 소상공인 대상, 한도 1억 (재신청 대기기간 별도 확인 필요)',
    });
  } else {
    results.push({ key: 'sinyong_bojeung', name: '신용보증재단', limit: 0, note: '매출 5억 이상으로 대상 아님' });
  }

  // 신보: 요식업/서비스업은 해당 없음. 도소매 매출 5억 이상이면 매출÷6
  if (isFoodOrService) {
    results.push({ key: 'sinbo', name: '신용보증기금(신보)', limit: 0, note: '요식업·서비스업은 대상 업종 아님' });
  } else if (isWholesale && revenue >= 50000) {
    results.push({ key: 'sinbo', name: '신용보증기금(신보)', limit: Math.round(revenue / 6), note: '도소매업 매출 5억 이상, 한도=매출÷6' });
  } else {
    results.push({ key: 'sinbo', name: '신용보증기금(신보)', limit: 0, note: '도소매 매출 5억 이상 조건 미충족' });
  }

  // 기보: 요식업/서비스업은 해당 없음. 제조업 매출 3억 이상이면 매출÷4
  if (isFoodOrService) {
    results.push({ key: 'gibo', name: '기술보증기금(기보)', limit: 0, note: '요식업·서비스업은 대상 업종 아님' });
  } else if (isManufacturing && revenue >= 30000) {
    results.push({ key: 'gibo', name: '기술보증기금(기보)', limit: Math.round(revenue / 4), note: '제조업 매출 3억 이상, 한도=매출÷4' });
  } else {
    results.push({ key: 'gibo', name: '기술보증기금(기보)', limit: 0, note: '제조업 매출 3억 이상 또는 기술특허·10년 경력 조건 확인 필요' });
  }

  return results;
}
