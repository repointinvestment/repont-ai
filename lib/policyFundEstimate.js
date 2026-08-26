// lib/policyFundEstimate.js
// 고객 대시보드의 "기관별 예상 가능 한도"에 쓰는 추정 계산.
// app/api/chat/route.js의 AI 상담 시스템 프롬프트에 정리된 실제 심사 기준을 그대로 반영했습니다.
// revenue_amount는 DB에 "만원" 단위로 저장되어 있습니다.

function industryMatches(industry, keywords) {
  const text = industry || '';
  return keywords.some((k) => text.includes(k));
}

function industryOrContentMatches(customer, keywords) {
  const text = `${customer.industry || ''} ${customer.business_content || ''}`;
  return keywords.some((k) => text.includes(k));
}

const WHOLESALE_KEYWORDS = ['도소매', '유통', '판매', '소매', '도매'];
const MANUFACTURING_KEYWORDS = ['제조'];
const FOOD_KEYWORDS = ['음식', '요식', '카페', '외식']; // 요식업만 — 일반 식당은 신보/기보 원칙적으로 대상 아님
const SERVICE_KEYWORDS = ['서비스업', '컨설팅', '용역']; // 규모 크면 도소매와 동일하게 매출÷6 적용
const FRANCHISE_KEYWORDS = ['프랜차이즈', '가맹', '체인'];

// customer: DB row (snake_case 필드)
export function estimateInstitutionLimits(customer) {
  const revenue = Number(customer.revenue_amount) || 0; // 만원
  const industry = customer.industry || '';
  const careerYears = Number(customer.owner_career_years) || 0;

  const isFood = industryMatches(industry, FOOD_KEYWORDS);
  const isFranchiseFood = isFood && industryOrContentMatches(customer, FRANCHISE_KEYWORDS);
  const isWholesaleOrService = industryMatches(industry, WHOLESALE_KEYWORDS) || industryMatches(industry, SERVICE_KEYWORDS);
  const isManufacturing = industryMatches(industry, MANUFACTURING_KEYWORDS);

  // 기관별 가점요소는 서로 다름 — 섞어서 표시하지 않도록 각자 따로 구성
  // 소진공 자체 가점: 노란우산공제, 여성기업확인서, 직접대출 성실상환 이력, 특허보유
  const sojinkongBonus = [];
  if (customer.has_yellow_umbrella) sojinkongBonus.push('노란우산공제');
  if (customer.has_woman_biz_cert) sojinkongBonus.push('여성기업확인서');
  if (customer.has_sojinkong_good_repayment) sojinkongBonus.push('직접대출 성실상환 이력');
  if (customer.has_patent) sojinkongBonus.push('특허보유');
  const sojinkongBonusSuffix = sojinkongBonus.length > 0 ? ` / 가점: ${sojinkongBonus.join(', ')}` : '';

  // 중진공·신보·기보 공통 가점: 기업부설연구소, 벤처인증
  const certBonus = [];
  if (customer.has_rnd_center) certBonus.push('기업부설연구소');
  if (customer.has_venture_cert) certBonus.push('벤처인증');
  const certBonusSuffix = certBonus.length > 0 ? ` / 가점: ${certBonus.join(', ')}` : '';

  // 대출현황 텍스트에서 기존 보증기관 이용 여부를 감지 — 정확한 대환 가능 여부는 상담사 판단 필요
  const loanText = customer.loan_status || '';
  const hasFoundationLoan = loanText.includes('재단');
  const hasSinboLoan = loanText.includes('신보') || loanText.includes('신용보증기금');
  const hasGiboLoan = loanText.includes('기보') || loanText.includes('기술보증기금');

  const results = [];

  // 소진공 직접대출: 기본 총한도 1억(10,000만원), 혁신형/도약형은 별도 2억(20,000만원)
  results.push({
    key: 'sojinkong',
    name: '소진공 직접대출',
    limit: 10000,
    note: `기본 총한도 (혁신형·도약형 조건 충족 시 2억 별도 적용)${sojinkongBonusSuffix}`,
    eligible: true,
  });

  // 신용보증재단: 매출 규모와 무관하게 기본 가능, 한도 1억. 이미 이용 중이면 재신청 대기기간 확인 필요.
  results.push({
    key: 'sinyong_bojeung',
    name: '신용보증재단',
    limit: 10000,
    note: hasFoundationLoan
      ? '한도 1억 (이미 이용 중 — 재신청 대기기간 확인 필요. 신보 대상 규모면 신보가 대환하는 경우도 있음)'
      : '한도 1억 (이미 이용 중이면 재신청 대기기간 별도 확인 필요)',
    eligible: true,
  });

  // 신보: 일반 식당은 원칙적으로 대상 아님. 프랜차이즈(가맹점)는 매출 기준으로 검토 가능.
  // 도소매·서비스업·제조업은 규모 기준 충족 시 가능.
  if (isFood && !isFranchiseFood) {
    results.push({ key: 'sinbo', name: '신용보증기금(신보)', limit: 0, note: '일반 식당은 원칙적으로 대상 아님 (프랜차이즈·가맹점은 별도 검토 가능)', eligible: false });
  } else if (isManufacturing && revenue >= 30000) {
    const crossNote = hasGiboLoan
      ? ' ⚠ 기보 잔액 보유 — 원칙적으로 동시 진행 불가, 매출·조건 우수 시 대환 검토 (상담사 판단 필요)'
      : hasFoundationLoan
        ? ' ⚠ 재단 대출 보유 — 신보가 재단 대출을 대환하며 보증서 재발급하는 경우 있음'
        : '';
    results.push({ key: 'sinbo', name: '신용보증기금(신보)', limit: Math.round(revenue / 4), note: `제조업 매출 3억 이상, 한도=매출÷4${certBonusSuffix}${crossNote}`, eligible: true });
  } else if ((isWholesaleOrService || isFranchiseFood) && revenue >= 50000) {
    const base = isFranchiseFood
      ? '프랜차이즈 매출 5억 이상, 한도=매출÷6 (가맹 여부 등 별도 심사 필요)'
      : '도소매·서비스업 매출 5억 이상, 한도=매출÷6';
    const crossNote = hasGiboLoan
      ? ' ⚠ 기보 잔액 보유 — 원칙적으로 동시 진행 불가, 매출·조건 우수 시 대환 검토 (상담사 판단 필요)'
      : hasFoundationLoan
        ? ' ⚠ 재단 대출 보유 — 신보가 재단 대출을 대환하며 보증서 재발급하는 경우 있음'
        : '';
    results.push({ key: 'sinbo', name: '신용보증기금(신보)', limit: Math.round(revenue / 6), note: `${base}${certBonusSuffix}${crossNote}`, eligible: true });
  } else {
    results.push({ key: 'sinbo', name: '신용보증기금(신보)', limit: 0, note: '매출 규모 조건 미충족', eligible: false });
  }

  // 기보: 가장 중요한 조건은 특허보유 또는 대표자 경력 10년 이상.
  const giboCore = [];
  if (customer.has_patent) giboCore.push('특허보유');
  if (careerYears >= 10) giboCore.push(`대표자 경력 ${careerYears}년`);

  if (isFood && !isFranchiseFood) {
    results.push({ key: 'gibo', name: '기술보증기금(기보)', limit: 0, note: '일반 식당은 원칙적으로 대상 아님 (프랜차이즈는 별도 검토 가능)', eligible: false });
  } else if (giboCore.length > 0) {
    const crossNote = hasSinboLoan
      ? ' ⚠ 신보 잔액 보유 — 원칙적으로 동시 진행 불가, 매출·조건 우수 시 대환 검토 (상담사 판단 필요)'
      : '';
    results.push({
      key: 'gibo',
      name: '기술보증기금(기보)',
      limit: null,
      note: `충족 요건: ${giboCore.join(', ')} — 정확한 한도는 상담 필요${certBonusSuffix}${crossNote}`,
      eligible: true,
    });
  } else {
    results.push({
      key: 'gibo',
      name: '기술보증기금(기보)',
      limit: 0,
      note: '특허보유 또는 대표자 경력 10년 이상 여부 확인 필요',
      eligible: false,
    });
  }

  // 중진공: 기준 미확정 — 확인 필요로만 표시
  results.push({
    key: 'jungjingong',
    name: '중진공(중소벤처기업진흥공단)',
    limit: 0,
    note: `기준 확인 필요 — 상담 시 별도 검토${certBonusSuffix}`,
    eligible: false,
  });

  return results;
}
