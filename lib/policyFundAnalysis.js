// lib/policyFundAnalysis.js
// app/components/PolicyFundAnalyzer.jsx에서 실전 검증된 계산 로직을 그대로 가져온 공통 함수.
// 고객 대시보드와 AI 상담 폼이 동일한 로직을 공유하도록 여기 한 곳에서만 관리합니다.

const FOOD_KEYWORDS = ['음식', '요식', '카페', '외식'];
const WHOLESALE_KEYWORDS = ['도소매', '유통', '판매', '소매', '도매'];
const SERVICE_KEYWORDS = ['서비스업', '컨설팅', '용역']; // 규모 크면 도소매와 동일하게 매출÷6 적용
const MANUFACTURING_KEYWORDS = ['제조'];
const FRANCHISE_KEYWORDS = ['프랜차이즈', '가맹', '체인'];

function industryMatches(industry, keywords) {
  const text = industry || '';
  return keywords.some((k) => text.includes(k));
}

// form: {
//   industry, bizAge, sales, employees, creditKCB, creditNICE,
//   sojingongLoans: { sinYong, hyuksin, jaedo, ilsi, etc },
//   loans: { jaedan, jaedanDate, jaedanRegion, shinbo, shinboDate, gibo, giboDate, jungjingong, bizCredit, personal1, personal2, cardLoan, cashService },
//   hasBankruptcy, currentBizCount, smartDevices: [], exportRecord, salesGrowth, taxDelinquent, isFranchise
// }
// 금액 단위는 전부 만원.
export function analyzePolicyFunds(form) {
  const num = (v) => Number(v) || 0;
  const hasPatent = !!form.hasPatent;
  const careerYears = num(form.careerYears);

  const bizAgeNum = num(form.bizAge);
  const salesNum = num(form.sales);
  const employeesNum = num(form.employees);
  const creditKCB = num(form.creditKCB);
  const creditNICE = num(form.creditNICE);

  const sojingongLoans = form.sojingongLoans || {};
  const sinYongLoan = num(sojingongLoans.sinYong);
  const hyuksinLoan = num(sojingongLoans.hyuksin);
  const jaedoLoan = num(sojingongLoans.jaedo);
  const ilsiLoan = num(sojingongLoans.ilsi);
  const etcLoan = num(sojingongLoans.etc);
  const totalSojingong = sinYongLoan + hyuksinLoan + jaedoLoan + ilsiLoan + etcLoan;

  const loans = form.loans || {};
  const jaedanLoan = num(loans.jaedan);
  const shinboLoan = num(loans.shinbo);
  const giboLoan = num(loans.gibo);
  const jungjingongLoan = num(loans.jungjingong);
  const bizCreditLoan = num(loans.bizCredit);
  const personal1 = num(loans.personal1);
  const personal2 = num(loans.personal2);
  const cardLoan = num(loans.cardLoan);
  const cashService = num(loans.cashService);

  const totalBizLoan = totalSojingong + jaedanLoan + shinboLoan + giboLoan + jungjingongLoan + bizCreditLoan;
  const totalPersonalLoan = personal1 + personal2 + cardLoan + cashService;
  const remainingCapacity = salesNum - totalBizLoan;

  const sojingongRemain = Math.max(0, 10000 - totalSojingong);
  const sojingongRemainHyuksin = Math.max(0, 20000 - totalSojingong);
  const sinYongAvailable = sinYongLoan < 3000;

  let jaedanCanReapply = true;
  let jaedanReapplyMsg = '';
  if (jaedanLoan > 0 && loans.jaedanDate) {
    const receivedDate = new Date(loans.jaedanDate);
    const today = new Date();
    const diffMonths = (today.getFullYear() - receivedDate.getFullYear()) * 12 + (today.getMonth() - receivedDate.getMonth());
    const requiredMonths = loans.jaedanRegion === '수도권' ? 12 : 6;
    jaedanCanReapply = diffMonths >= requiredMonths;
    if (!jaedanCanReapply) {
      const remaining = requiredMonths - diffMonths;
      jaedanReapplyMsg = `재단 재신청 불가 — ${loans.jaedanRegion === '수도권' ? '수도권 1년' : '지방 6개월'} 기준 미충족 (약 ${remaining}개월 후 가능)`;
    } else {
      jaedanReapplyMsg = `재단 재신청 가능 ✅ (${loans.jaedanRegion === '수도권' ? '수도권 1년' : '지방 6개월'} 경과)`;
    }
  }

  const results = [];
  const warnings = [];
  const checks = [];

  const industry = form.industry || '';
  const isManufacturing = industryMatches(industry, MANUFACTURING_KEYWORDS);
  const isRestaurant = industryMatches(industry, FOOD_KEYWORDS);
  const isFranchiseFood = isRestaurant && (form.isFranchise || industryMatches(industry, FRANCHISE_KEYWORDS));
  const isRetail = industryMatches(industry, WHOLESALE_KEYWORDS) || industryMatches(industry, SERVICE_KEYWORDS);
  const isManuf = isManufacturing;
  const maxEmployees = (isManufacturing || industryMatches(industry, ['건설', '운수'])) ? 9 : 4;

  if (employeesNum > maxEmployees) {
    warnings.push(`⚠️ ${industry || '해당 업종'} 기준 소상공인 상한 ${maxEmployees}명 초과 (현재 ${employeesNum}명) → 정책자금 신청 불가`);
  }
  if (form.taxDelinquent === 'yes') {
    warnings.push('⚠️ 국세·지방세 체납 중 → 정책자금 신청 불가 (체납 해소 후 신청 가능)');
  }
  if (bizAgeNum >= 7) {
    if (remainingCapacity < 0) {
      warnings.push(`⚠️ 업력 ${bizAgeNum}년 (7년 이상) — 매출 ${salesNum.toLocaleString()}만원 - 사업자대출 ${totalBizLoan.toLocaleString()}만원 = ${remainingCapacity.toLocaleString()}만원 → 매출초과차입금 기준 초과, 신청 불가`);
    } else {
      checks.push(`✅ 업력 ${bizAgeNum}년 (7년 이상) — 매출초과차입금 여유 ${remainingCapacity.toLocaleString()}만원`);
    }
  } else if (bizAgeNum > 0) {
    checks.push(`✅ 업력 ${bizAgeNum}년 (7년 미만) — 매출초과차입금 기준 미적용`);
  }

  if (jaedanReapplyMsg) {
    jaedanCanReapply ? checks.push(jaedanReapplyMsg) : warnings.push(`⚠️ ${jaedanReapplyMsg}`);
  }

  const canApply = form.taxDelinquent !== 'yes' && employeesNum <= maxEmployees && (bizAgeNum < 7 || remainingCapacity >= 0);
  const smartDevices = form.smartDevices || [];
  const hasSmartDevice = smartDevices.length > 0;
  const creditScore = creditKCB || creditNICE;

  // 혁신성장촉진자금 일반형
  if (canApply && hasSmartDevice && sojingongRemain > 0) {
    results.push({
      tag: '소진공 직접대출',
      name: '혁신성장촉진자금 일반형',
      limit: `최대 ${Math.min(sojingongRemain, 10000).toLocaleString()}만원`,
      rate: '정책자금 기준금리 + 0.4%p',
      period: '운전 5년 (거치 2년) / 시설 8년 (거치 3년)',
      condition: `스마트기기 보유 ✅ | 소진공 잔여한도 ${sojingongRemain.toLocaleString()}만원`,
      color: '#0f3460',
      cap: 10000,
    });
  }
  if (!hasSmartDevice && canApply) {
    checks.push('💡 스마트기기 보유 시 혁신성장촉진자금 신청이 가능합니다. 현재는 보유 스마트기기가 없어 대상이 아닙니다.');
  }

  // 혁신성장촉진자금 혁신형
  const isHyuksin = form.exportRecord === 'yes' || form.salesGrowth === 'yes';
  if (canApply && isHyuksin && hasSmartDevice && sojingongRemainHyuksin > 0) {
    results.push({
      tag: '소진공 직접대출',
      name: '혁신성장촉진자금 혁신형',
      limit: `최대 ${Math.min(sojingongRemainHyuksin, 20000).toLocaleString()}만원`,
      rate: '정책자금 기준금리 + 0.4%p',
      period: '운전 5년 (거치 2년) / 시설 8년 (거치 3년)',
      condition: form.exportRecord === 'yes' ? '수출 실적 1천달러 이상 ✅' : '2년 연속 매출 10% 증가 ✅',
      color: '#0f3460',
      cap: 20000,
    });
  }

  // 재도전특별자금
  if (canApply && form.hasBankruptcy === 'yes' && form.currentBizCount === '1' && bizAgeNum < 7 && sojingongRemain > 0) {
    results.push({
      tag: '소진공 직접대출',
      name: '재도전특별자금 일반형',
      limit: `최대 ${Math.min(sojingongRemain, 7000).toLocaleString()}만원`,
      rate: '정책자금 기준금리 + 0.4%p',
      period: '운전 5년 (거치 2년) / 시설 8년 (거치 3년)',
      condition: '폐업이력 ✅ + 사업자 1개 ✅ + 업력 7년 미만 ✅',
      color: '#0f3460',
      cap: 7000,
    });
  }

  // 신용취약소상공인
  const creditEligible = creditScore >= 595 && creditScore <= 839;
  if (canApply && sinYongAvailable && creditEligible) {
    const remaining = 3000 - sinYongLoan;
    results.push({
      tag: '소진공 직접대출',
      name: '신용취약소상공인자금',
      limit: `최대 ${remaining.toLocaleString()}만원`,
      rate: '정책자금 기준금리 + 0.4%p',
      period: '5년 (거치 2년)',
      condition: `신용점수 ${creditScore}점 (595~839점 해당) ✅ | 잔여한도 ${remaining.toLocaleString()}만원`,
      color: '#1565c0',
      cap: 3000,
    });
  } else {
    if (!sinYongAvailable) {
      warnings.push('⚠️ 신용취약소상공인자금 — 3,000만원 한도 소진으로 추가 신청 불가');
    }
    if (creditScore > 839) {
      warnings.push(`⚠️ 신용취약소상공인자금 — 신용점수 ${creditScore}점으로 대상 범위(595~839점) 초과, 신청 불가`);
    }
    if (creditScore > 0 && creditScore < 595) {
      warnings.push(`⚠️ 신용취약소상공인자금 — 신용점수 ${creditScore}점으로 최저 기준(595점) 미달, 신청 불가`);
    }
  }

  // 신용보증재단
  const jaedanRemain = Math.max(0, 10000 - jaedanLoan);
  if (canApply && jaedanRemain > 0 && jaedanCanReapply) {
    results.push({
      tag: '간접대출 (보증)',
      name: '신용보증재단',
      limit: `최대 ${jaedanRemain.toLocaleString()}만원`,
      rate: '은행 대출금리 적용',
      period: '은행별 상이',
      condition: `잔여 보증한도 ${jaedanRemain.toLocaleString()}만원 ※ 재단/신보/기보 중 1개만 선택`,
      color: '#2e7d32',
      cap: 10000,
    });
  }

  // 신보 재신청 가능 여부
  let shinboCanReapply = true;
  if (shinboLoan > 0 && loans.shinboDate) {
    const shinboDate = new Date(loans.shinboDate);
    const today = new Date();
    const diffMonths = (today.getFullYear() - shinboDate.getFullYear()) * 12 + (today.getMonth() - shinboDate.getMonth());
    shinboCanReapply = diffMonths >= 12;
    if (!shinboCanReapply) {
      const remaining = 12 - diffMonths;
      warnings.push(`⚠️ 신용보증기금 재신청 불가 — 1년 기준 미충족 (약 ${remaining}개월 후 가능)`);
    } else {
      checks.push('✅ 신용보증기금 재신청 가능 (1년 경과)');
    }
  }

  // 기보 재신청 가능 여부
  let giboCanReapply = true;
  if (giboLoan > 0 && loans.giboDate) {
    const giboDate = new Date(loans.giboDate);
    const today = new Date();
    const diffMonths = (today.getFullYear() - giboDate.getFullYear()) * 12 + (today.getMonth() - giboDate.getMonth());
    giboCanReapply = diffMonths >= 12;
    if (!giboCanReapply) {
      const remaining = 12 - diffMonths;
      warnings.push(`⚠️ 기술보증기금 재신청 불가 — 1년 기준 미충족 (약 ${remaining}개월 후 가능)`);
    } else {
      checks.push('✅ 기술보증기금 재신청 가능 (1년 경과)');
    }
  }

  // 신보 (일반 식당은 원칙적으로 대상 아님. 프랜차이즈는 매출 기준으로 검토 가능)
  if (canApply && shinboCanReapply && (!isRestaurant || isFranchiseFood) && ((isRetail && salesNum >= 50000) || (isManuf && salesNum >= 30000) || (isFranchiseFood && salesNum >= 50000))) {
    const shinboLimit = isManuf ? Math.floor(salesNum / 4) : Math.floor(salesNum / 6);
    results.push({
      tag: '간접대출 (보증)',
      name: '신용보증기금 (신보)',
      limit: `최대 ${shinboLimit.toLocaleString()}만원`,
      rate: '은행 대출금리 적용',
      period: '은행별 상이',
      condition: `매출 ÷ ${isManuf ? 4 : 6} = ${shinboLimit.toLocaleString()}만원 ※ 재단/신보/기보 중 1개만 선택`,
      color: '#2e7d32',
      cap: null,
    });
  }
  if (isRestaurant && !isFranchiseFood) {
    checks.push('ℹ️ 신용보증기금·기술보증기금은 요식업 특성상 대상 업종이 아닙니다 (프랜차이즈·가맹점은 별도 검토 가능)');
  }

  // 기보: 핵심 조건은 특허보유 또는 대표자 경력 10년 이상 (매출/업종 기준 아님)
  const giboCore = [];
  if (hasPatent) giboCore.push('특허보유');
  if (careerYears >= 10) giboCore.push(`대표자 경력 ${careerYears}년`);
  if (isRestaurant && !isFranchiseFood) {
    // 일반 식당은 원칙적으로 대상 아님 — 별도 안내 없이 결과에서 제외
  } else if (canApply && giboCanReapply && giboCore.length > 0) {
    const giboRemain = Math.max(0, 10000 - giboLoan);
    results.push({
      tag: '간접대출 (보증)',
      name: '기술보증기금 (기보)',
      limit: giboRemain > 0 ? `잔여 보증한도 ${giboRemain.toLocaleString()}만원 (참고용, 정확한 한도는 상담 필요)` : '금액 상담 필요',
      rate: '은행 대출금리 적용',
      period: '은행별 상이',
      condition: `충족 요건: ${giboCore.join(', ')} ※ 재단/신보/기보 중 1개만 선택`,
      color: '#6a1b9a',
      cap: null,
    });
  } else if (canApply && giboCore.length === 0) {
    checks.push('ℹ️ 기술보증기금(기보) — 특허보유 또는 대표자 경력 10년 이상 조건 확인 필요');
  }

  // 중진공: 정확한 심사 기준 미확정 — 별도 상담 필요로만 안내
  if (canApply) {
    checks.push('ℹ️ 중진공(중소벤처기업진흥공단) — 기준 확인 필요, 상담 시 별도 검토');
  }

  return {
    results,
    warnings,
    checks,
    totalBizLoan,
    totalPersonalLoan,
    remainingCapacity,
    sojingongRemain,
    sojingongRemainHyuksin,
    bizAgeNum,
    salesNum,
  };
}
