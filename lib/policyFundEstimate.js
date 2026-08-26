// lib/policyFundEstimate.js
// 고객 대시보드의 "기관별 예상 가능 한도"에 쓰는 추정 계산.
// app/api/chat/route.js의 AI 상담 시스템 프롬프트에 정리된 실제 심사 기준을 그대로 반영했습니다.
// revenue_amount는 DB에 "만원" 단위로 저장되어 있습니다.

function industryMatches(industry, keywords) {
  const text = industry || '';
  return keywords.some((k) => text.includes(k));
}

const WHOLESALE_KEYWORDS = ['도소매', '유통', '판매', '소매', '도매'];
const MANUFACTURING_KEYWORDS = ['제조'];
const FOOD_KEYWORDS = ['음식', '요식', '카페', '외식']; // 요식업만 — 신보/기보 대상 아님
const SERVICE_KEYWORDS = ['서비스업', '컨설팅', '용역']; // 규모 크면 도소매와 동일하게 매출÷6 적용

const FRANCHISE_KEYWORDS = ['프랜차이즈', '가맹', '체인'];

function industryOrContentMatches(customer, keywords) {
  const text = `${customer.industry || ''} ${customer.business_content || ''}`;
  return keywords.some((k) => text.includes(k));
}

// customer: DB row (snake_case 필드)
export function estimateInstitutionLimits(customer) {
  const revenue = Number(customer.revenue_amount) || 0; // 만원
  const industry = customer.industry || '';

  const isFood = industryMatches(industry, FOOD_KEYWORDS);
  const isFranchiseFood = isFood && industryOrContentMatches(customer, FRANCHISE_KEYWORDS);
  const isWholesaleOrService = industryMatches(industry, WHOLESALE_KEYWORDS) || industryMatches(industry, SERVICE_KEYWORDS);
  const isManufacturing = industryMatches(industry, MANUFACTURING_KEYWORDS);

  const results = [];

  // 소진공 직접대출: 기본 총한도 1억(10,000만원), 혁신형/도약형은 별도 2억(20,000만원)
  results.push({
    key: 'sojinkong',
    name: '소진공 직접대출',
    limit: 10000,
    note: '기본 총한도 (혁신형·도약형 조건 충족 시 2억 별도 적용)',
    eligible: true,
  });

  // 신용보증재단: 매출 5억(50,000만원) 미만 소상공인 대부분 해당, 한도 1억
  if (revenue < 50000) {
    results.push({
      key: 'sinyong_bojeung',
      name: '신용보증재단',
      limit: 10000,
      note: '매출 5억 미만 소상공인 대상, 한도 1억 (재신청 대기기간 별도 확인 필요)',
      eligible: true,
    });
  } else {
    results.push({ key: 'sinyong_bojeung', name: '신용보증재단', limit: 0, note: '매출 5억 이상으로 대상 아님', eligible: false });
  }

  // 신보: 일반 식당은 원칙적으로 대상 아님. 프랜차이즈(가맹점)는 심사 가능한 경우가 있어 매출 기준 검토.
  // 도소매·서비스업·제조업은 규모 기준 충족 시 가능.
  if (isFood && !isFranchiseFood) {
    results.push({ key: 'sinbo', name: '신용보증기금(신보)', limit: 0, note: '일반 식당은 원칙적으로 대상 아님 (프랜차이즈·가맹점은 별도 검토 가능)', eligible: false });
  } else if (isManufacturing && revenue >= 30000) {
    results.push({ key: 'sinbo', name: '신용보증기금(신보)', limit: Math.round(revenue / 4), note: '제조업 매출 3억 이상, 한도=매출÷4', eligible: true });
  } else if ((isWholesaleOrService || isFranchiseFood) && revenue >= 50000) {
    const note = isFranchiseFood
      ? '프랜차이즈 매출 5억 이상, 한도=매출÷6 (가맹 여부 등 별도 심사 필요)'
      : '도소매·서비스업 매출 5억 이상, 한도=매출÷6';
    results.push({ key: 'sinbo', name: '신용보증기금(신보)', limit: Math.round(revenue / 6), note, eligible: true });
  } else {
    results.push({ key: 'sinbo', name: '신용보증기금(신보)', limit: 0, note: '매출 규모 조건 미충족', eligible: false });
  }

  // 기보: 매출/업종 기준이 아니라 아래 요건 중 하나라도 충족하면 상담 가능
  // (규모 있는 기업: 특허·노란우산공제·기업부설연구소·벤처인증 / 소규모: 노란우산공제·특허 위주 확인)
  const giboFlags = [];
  if (customer.has_patent) giboFlags.push('특허보유');
  if (customer.has_yellow_umbrella) giboFlags.push('노란우산공제');
  if (customer.has_rnd_center) giboFlags.push('기업부설연구소');
  if (customer.has_venture_cert) giboFlags.push('벤처인증');

  if (giboFlags.length > 0) {
    results.push({
      key: 'gibo',
      name: '기술보증기금(기보)',
      limit: null,
      note: `충족 요건: ${giboFlags.join(', ')} — 정확한 한도는 상담 필요`,
      eligible: true,
    });
  } else {
    results.push({
      key: 'gibo',
      name: '기술보증기금(기보)',
      limit: 0,
      note: isFood && !isFranchiseFood
        ? '일반 식당은 원칙적으로 대상 아님 (프랜차이즈는 특허·인증 조건 충족 시 검토 가능)'
        : '특허보유·노란우산공제·기업부설연구소·벤처인증 여부 확인 필요',
      eligible: false,
    });
  }

  results.push({
    key: 'jungjingong',
    name: '중진공(중소벤처기업진흥공단)',
    limit: 0,
    note: '기준 확인 필요 — 상담 시 별도 검토',
    eligible: false,
  });

  return results;
}
