// lib/policyFundEstimate.js
// 고객 대시보드의 "기관별 한도 소진 현황"에 쓰는 참고용 추정 계산.
// 실제 심사 기준(지역/업력/신용점수 등)에 따라 달라질 수 있으므로 정확한 심사 결과가 아닌
// 참고 자료로만 사용합니다. 화면에도 "참고자료" 배지를 함께 표시합니다.

// 업종명에 특정 키워드가 포함되어 있으면 기보/신보 매출 배수를 다르게 적용
function getRevenueMultiplier(industry) {
  const text = industry || '';
  if (text.includes('도소매') || text.includes('유통')) return { multiplier: 1 / 6, label: '도소매업 매출×1/6' };
  if (text.includes('제조')) return { multiplier: 1 / 4, label: '제조업 매출×1/4' };
  return { multiplier: 1 / 5, label: '일반업종 매출×1/5(추정)' };
}

// customer: DB row (snake_case 필드), revenueAmount 단위는 만원
export function estimateInstitutionLimits(customer) {
  const revenue = Number(customer.revenue_amount) || 0;
  const { multiplier, label } = getRevenueMultiplier(customer.industry);
  const giboShinboLimit = Math.round(revenue * multiplier);

  return [
    {
      key: 'sinyong_bojeung',
      name: '신용보증재단',
      limit: 10000, // 만원, 지역별 상이 — 참고값
      note: '지역별 상이 (참고값)',
    },
    {
      key: 'sojinkong_general',
      name: '소진공 · 일반경영',
      limit: 7000,
      note: '업력·매출 요건 충족 시',
    },
    {
      key: 'sojinkong_innovation',
      name: '소진공 · 혁신형',
      limit: 20000,
      note: '수출·매출신장·스마트공장 등 요건 충족 시',
    },
    {
      key: 'gibo_shinbo',
      name: '기보/신보',
      limit: giboShinboLimit,
      note: label,
    },
  ];
}
