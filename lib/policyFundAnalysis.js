// lib/policyFundAnalysis.js
// app/components/PolicyFundAnalyzer.jsx에서 실전 검증된 계산 로직을 그대로 가져온 공통 함수.
// 고객 대시보드와 AI 상담 폼이 동일한 로직을 공유하도록 여기 한 곳에서만 관리합니다.
//
// 2026-09-02: 하드코딩돼 있던 한도·금리·기간·기준 수치를 전부 lib/policyFundsSeed.js 기반
// 마스터 DB(fundsByKey/rulesByKey)에서 읽도록 리팩터링. 분기 구조(어떤 조건일 때 어떤 자금을
// 보여줄지)는 그대로 유지 — 마스터 DB에 아직 "임의 조건 → 결과" 형태의 범용 판정 엔진이 없어서,
// 숫자·문구만 DB화하고 판정 흐름은 기존 코드를 그대로 옮겼습니다.
// 호출 시 반드시 fundsByKey(lib/policyFundsLookup.indexFunds 결과)와 rulesByKey(indexRules 결과)를
// 넘겨야 합니다 — 비어있으면 모든 결과가 빈 배열로 나옵니다(과거 하드코딩 값으로 되돌아가지 않음).

const FOOD_KEYWORDS = ['음식', '요식', '카페', '외식'];
const WHOLESALE_KEYWORDS = ['도소매', '유통', '판매', '소매', '도매'];
const SERVICE_KEYWORDS = ['서비스업', '컨설팅', '용역']; // 규모 크면 도소매와 동일하게 매출÷6 적용
const MANUFACTURING_KEYWORDS = ['제조'];
const FRANCHISE_KEYWORDS = ['프랜차이즈', '가맹', '체인'];

function industryMatches(industry, keywords) {
  const text = industry || '';
  return keywords.some((k) => text.includes(k));
}

function monthsSince(dateStr) {
  if (!dateStr) return null;
  const then = new Date(dateStr);
  const today = new Date();
  return (today.getFullYear() - then.getFullYear()) * 12 + (today.getMonth() - then.getMonth());
}

// form: {
//   industry, bizAge, sales, employees, creditKCB, creditNICE,
//   sojingongLoans: { sinYong, hyuksin, jaedo, ilsi, etc },
//   loans: { jaedan, jaedanDate, jaedanRegion, shinbo, shinboDate, gibo, giboDate, jungjingong, bizCredit, personal1, personal2, cardLoan, cashService },
//   hasBankruptcy, currentBizCount, smartDevices: [], exportRecord, salesGrowth, taxDelinquent, isFranchise
// }
// fundsByKey / rulesByKey: lib/policyFundsLookup.indexFunds(funds) / indexRules(rules) — /api/policy-funds?active=1 응답 기반.
// 금액 단위는 전부 만원.
export function analyzePolicyFunds(form, fundsByKey = {}, rulesByKey = {}) {
  // 쉼표 포맷 문자열("8,000")과 순수 숫자(DB row 값) 둘 다 안전하게 처리 — PolicyFundAnalyzer.jsx 폼은
  // 쉼표 포맷 문자열을, app/customers/[id]/page.js는 DB의 순수 숫자를 넘김.
  const num = (v) => Number(String(v ?? '').replace(/[^0-9.-]/g, '')) || 0;
  const hasPatent = !!form.hasPatent;
  const careerYears = num(form.careerYears);

  const bizAgeNum = num(form.bizAge);
  const salesNum = num(form.sales);
  const employeesNum = num(form.employees);
  const creditKCB = num(form.creditKCB);
  const creditNICE = num(form.creditNICE);

  // ── 마스터 DB에서 자금 정의 가져오기 (없으면 해당 자금은 결과에서 조용히 빠짐) ──
  const fHyuksinGeneral = fundsByKey.sojinkong_hyuksin_general;
  const fHyuksinInnov = fundsByKey.sojinkong_hyuksin_innovative;
  const fJaedoGeneral = fundsByKey.sojinkong_jaedo_general;
  // fundsByKey.sojinkong_jaedo_leap(재도전특별자금 도약형)는 기존 코드에도 매칭 분기가 없어 그대로 미사용 — 3단계 이후 추가 검토 대상.
  const fCreditVulnerable = fundsByKey.sojinkong_credit_vulnerable;
  const fJaedan = fundsByKey.jaedan;
  const fShinbo = fundsByKey.shinbo;
  const fGibo = fundsByKey.gibo;

  const rEmployeeLimit = rulesByKey.small_business_employee_limit;
  const rDebtOverSales = rulesByKey.debt_over_sales;
  const rSojinkongCap = rulesByKey.sojinkong_total_cap;

  const capGroups = rSojinkongCap?.params?.cap_groups || {};
  const capOf = (fund) => (fund ? capGroups[fund.cap_group] ?? fund.limit_operating ?? 0 : 0);

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

  const sojingongBaseCap = capOf(fHyuksinGeneral); // 소진공_기본_1억
  const sojingongExpandedCap = capOf(fHyuksinInnov); // 소진공_확장_2억
  const sojingongRemain = Math.max(0, sojingongBaseCap - totalSojingong);
  const sojingongRemainHyuksin = Math.max(0, sojingongExpandedCap - totalSojingong);
  const creditVulnerableCap = fCreditVulnerable?.limit_operating ?? 0;
  const sinYongAvailable = sinYongLoan < creditVulnerableCap;

  const jaedanCap = fJaedan?.limit_operating ?? 0;
  const jaedanMonthsByRegion = fJaedan?.reapply_rule?.months_by_region || {};
  let jaedanCanReapply = true;
  let jaedanReapplyMsg = '';
  if (jaedanLoan > 0 && loans.jaedanDate) {
    const diffMonths = monthsSince(loans.jaedanDate);
    const requiredMonths = loans.jaedanRegion === '수도권' ? (jaedanMonthsByRegion['수도권'] ?? 12) : (jaedanMonthsByRegion['지방'] ?? 6);
    jaedanCanReapply = diffMonths >= requiredMonths;
    const regionLabel = loans.jaedanRegion === '수도권' ? `수도권 ${requiredMonths / 12}년` : `지방 ${requiredMonths}개월`;
    if (!jaedanCanReapply) {
      const remaining = requiredMonths - diffMonths;
      jaedanReapplyMsg = `재단 재신청 불가 — ${regionLabel} 기준 미충족 (약 ${remaining}개월 후 가능)`;
    } else {
      jaedanReapplyMsg = `재단 재신청 가능 ✅ (${regionLabel} 경과)`;
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

  const employeeLimits = rEmployeeLimit?.params?.limits || {};
  const maxEmployees = (isManufacturing || industryMatches(industry, ['건설', '운수']))
    ? (employeeLimits['제조·건설·운수·광업'] ?? 9)
    : (employeeLimits['그 외'] ?? 4);

  if (employeesNum > maxEmployees) {
    warnings.push(`⚠️ ${industry || '해당 업종'} 기준 소상공인 상한 ${maxEmployees}명 초과 (현재 ${employeesNum}명) → 정책자금 신청 불가`);
  }
  if (form.taxDelinquent === 'yes') {
    warnings.push('⚠️ 국세·지방세 체납 중 → 정책자금 신청 불가 (체납 해소 후 신청 가능)');
  }
  const debtCheckFromBizAge = rDebtOverSales?.params?.applies_from_biz_age ?? 7;
  if (bizAgeNum >= debtCheckFromBizAge) {
    if (remainingCapacity < 0) {
      warnings.push(`⚠️ 업력 ${bizAgeNum}년 (${debtCheckFromBizAge}년 이상) — 매출 ${salesNum.toLocaleString()}만원 - 사업자대출 ${totalBizLoan.toLocaleString()}만원 = ${remainingCapacity.toLocaleString()}만원 → 매출초과차입금 기준 초과, 신청 불가`);
    } else {
      checks.push(`✅ 업력 ${bizAgeNum}년 (${debtCheckFromBizAge}년 이상) — 매출초과차입금 여유 ${remainingCapacity.toLocaleString()}만원`);
    }
  } else if (bizAgeNum > 0) {
    checks.push(`✅ 업력 ${bizAgeNum}년 (${debtCheckFromBizAge}년 미만) — 매출초과차입금 기준 미적용`);
  }

  if (jaedanReapplyMsg) {
    jaedanCanReapply ? checks.push(jaedanReapplyMsg) : warnings.push(`⚠️ ${jaedanReapplyMsg}`);
  }

  const canApply = form.taxDelinquent !== 'yes' && employeesNum <= maxEmployees && (bizAgeNum < debtCheckFromBizAge || remainingCapacity >= 0);
  const smartDevices = form.smartDevices || [];
  const hasSmartDevice = smartDevices.length > 0;
  const creditScore = creditKCB || creditNICE;

  // 혁신성장촉진자금 일반형
  if (fHyuksinGeneral && canApply && hasSmartDevice && sojingongRemain > 0) {
    results.push({
      tag: '소진공 직접대출',
      name: fHyuksinGeneral.name,
      limit: `최대 ${Math.min(sojingongRemain, sojingongBaseCap).toLocaleString()}만원`,
      rate: fHyuksinGeneral.rate_note,
      period: fHyuksinGeneral.period_note,
      condition: `스마트기기 보유 ✅ | 소진공 잔여한도 ${sojingongRemain.toLocaleString()}만원`,
      color: '#0f3460',
      cap: sojingongBaseCap,
    });
  }
  if (!hasSmartDevice && canApply) {
    checks.push('💡 스마트기기 보유 시 혁신성장촉진자금 신청이 가능합니다. 현재는 보유 스마트기기가 없어 대상이 아닙니다.');
  }

  // 혁신성장촉진자금 혁신형
  const isHyuksin = form.exportRecord === 'yes' || form.salesGrowth === 'yes';
  if (fHyuksinInnov && canApply && isHyuksin && hasSmartDevice && sojingongRemainHyuksin > 0) {
    results.push({
      tag: '소진공 직접대출',
      name: fHyuksinInnov.name,
      limit: `최대 ${Math.min(sojingongRemainHyuksin, sojingongExpandedCap).toLocaleString()}만원`,
      rate: fHyuksinInnov.rate_note,
      period: fHyuksinInnov.period_note,
      condition: form.exportRecord === 'yes' ? '수출 실적 1천달러 이상 ✅' : '2년 연속 매출 10% 증가 ✅',
      color: '#0f3460',
      cap: sojingongExpandedCap,
    });
  }

  // 재도전특별자금 일반형
  const jaedoMaxBizAge = fJaedoGeneral?.criteria?.max_biz_age_exclusive ?? 7;
  const jaedoQualifies = form.hasBankruptcy === 'yes' && form.currentBizCount === '1' && bizAgeNum < jaedoMaxBizAge;
  if (fJaedoGeneral && canApply && jaedoQualifies && sojingongRemain > 0) {
    results.push({
      tag: '소진공 직접대출',
      name: fJaedoGeneral.name,
      limit: `최대 ${Math.min(sojingongRemain, fJaedoGeneral.limit_operating).toLocaleString()}만원`,
      rate: fJaedoGeneral.rate_note,
      period: fJaedoGeneral.period_note,
      condition: `폐업이력 ✅ + 사업자 1개 ✅ + 업력 ${jaedoMaxBizAge}년 미만 ✅`,
      color: '#0f3460',
      cap: fJaedoGeneral.limit_operating,
    });
  } else if (fJaedoGeneral && canApply && !jaedoQualifies) {
    // 신용취약소상공인자금처럼, 왜 대상이 아닌지 조건별로 짚어서 알려줌 — 충족된 조건은 굳이 다시 말하지 않고
    // 실패한 조건만 나열 (예: 폐업이력·업력은 되는데 사업자 개수만 안 되는 경우 그것만 언급).
    const failReasons = [];
    if (form.hasBankruptcy !== 'yes') failReasons.push('폐업이력(또는 업종전환·휴업·매출감소 재도전 사유) 없음');
    if (form.currentBizCount && form.currentBizCount !== '1') failReasons.push(`현재 운영중인 사업자 ${form.currentBizCount}개 (1개여야 함)`);
    if (bizAgeNum >= jaedoMaxBizAge) failReasons.push(`업력 ${bizAgeNum}년 (${jaedoMaxBizAge}년 미만이어야 함)`);
    if (failReasons.length > 0) {
      warnings.push(`⚠️ ${fJaedoGeneral.name} — ${failReasons.join(' / ')} → 신청 불가`);
    }
  } else if (fJaedoGeneral && canApply && jaedoQualifies && sojingongRemain <= 0) {
    warnings.push(`⚠️ ${fJaedoGeneral.name} — 폐업이력 ✅ + 사업자 1개 ✅ + 업력 ${jaedoMaxBizAge}년 미만 ✅ 조건은 충족하지만 소진공 총한도 소진으로 신청 불가`);
  }

  // 신용취약소상공인
  const creditMin = fCreditVulnerable?.criteria?.credit_min ?? 595;
  const creditMax = fCreditVulnerable?.criteria?.credit_max ?? 839;
  const creditEligible = creditScore >= creditMin && creditScore <= creditMax;
  if (fCreditVulnerable && canApply && sinYongAvailable && creditEligible) {
    const remaining = creditVulnerableCap - sinYongLoan;
    results.push({
      tag: '소진공 직접대출',
      name: fCreditVulnerable.name,
      limit: `최대 ${remaining.toLocaleString()}만원`,
      rate: fCreditVulnerable.rate_note,
      period: fCreditVulnerable.period_note,
      condition: `신용점수 ${creditScore}점 (${creditMin}~${creditMax}점 해당) ✅ | 잔여한도 ${remaining.toLocaleString()}만원`,
      color: '#1565c0',
      cap: creditVulnerableCap,
    });
  } else if (fCreditVulnerable) {
    if (!sinYongAvailable) {
      warnings.push(`⚠️ ${fCreditVulnerable.name} — ${creditVulnerableCap.toLocaleString()}만원 한도 소진으로 추가 신청 불가`);
    }
    if (creditScore > creditMax) {
      warnings.push(`⚠️ ${fCreditVulnerable.name} — 신용점수 ${creditScore}점으로 대상 범위(${creditMin}~${creditMax}점) 초과, 신청 불가`);
    }
    if (creditScore > 0 && creditScore < creditMin) {
      warnings.push(`⚠️ ${fCreditVulnerable.name} — 신용점수 ${creditScore}점으로 최저 기준(${creditMin}점) 미달, 신청 불가`);
    }
  }

  // 재단/신보/기보 중복 이용 여부 확인 — 이미 하나를 쓰고 있으면 다른 건 원칙적으로 신규 진행 불가 (대환 등은 상담 필요)
  const jaedanActive = jaedanLoan > 0;
  const shinboActive = shinboLoan > 0;
  const giboActive = giboLoan > 0;

  // 신용보증재단
  const jaedanRemain = Math.max(0, jaedanCap - jaedanLoan);
  if (shinboActive || giboActive) {
    if (!jaedanActive) {
      warnings.push(`⚠️ 이미 ${shinboActive ? '신보' : '기보'} 이용 중 — 신용보증재단 신규 보증은 원칙적으로 불가 (대환 등 예외는 상담 필요)`);
    }
  } else if (fJaedan && canApply && jaedanRemain > 0 && jaedanCanReapply) {
    results.push({
      tag: '간접대출 (보증)',
      name: fJaedan.name,
      limit: `최대 ${jaedanRemain.toLocaleString()}만원`,
      rate: fJaedan.rate_note,
      period: fJaedan.period_note,
      condition: `잔여 보증한도 ${jaedanRemain.toLocaleString()}만원 ※ 재단/신보/기보 중 1개만 선택`,
      color: '#2e7d32',
      cap: jaedanCap,
    });
  }

  // 신보 재신청 가능 여부
  const shinboReapplyMonths = fShinbo?.reapply_rule?.months ?? 12;
  let shinboCanReapply = true;
  if (shinboLoan > 0 && loans.shinboDate) {
    const diffMonths = monthsSince(loans.shinboDate);
    shinboCanReapply = diffMonths >= shinboReapplyMonths;
    if (!shinboCanReapply) {
      const remaining = shinboReapplyMonths - diffMonths;
      warnings.push(`⚠️ 신용보증기금 재신청 불가 — ${shinboReapplyMonths}개월 기준 미충족 (약 ${remaining}개월 후 가능)`);
    } else {
      checks.push(`✅ 신용보증기금 재신청 가능 (${shinboReapplyMonths}개월 경과)`);
    }
  }

  // 기보 재신청 가능 여부
  const giboReapplyMonths = fGibo?.reapply_rule?.months ?? 12;
  let giboCanReapply = true;
  if (giboLoan > 0 && loans.giboDate) {
    const diffMonths = monthsSince(loans.giboDate);
    giboCanReapply = diffMonths >= giboReapplyMonths;
    if (!giboCanReapply) {
      const remaining = giboReapplyMonths - diffMonths;
      warnings.push(`⚠️ 기술보증기금 재신청 불가 — ${giboReapplyMonths}개월 기준 미충족 (약 ${remaining}개월 후 가능)`);
    } else {
      checks.push(`✅ 기술보증기금 재신청 가능 (${giboReapplyMonths}개월 경과)`);
    }
  }

  // 신보 (일반 식당은 원칙적으로 대상 아님. 프랜차이즈는 매출 기준으로 검토 가능)
  const shinboFormula = fShinbo?.criteria?.limit_formula || {};
  const shinboRetail = shinboFormula['도소매서비스'] || { sales_min: 50000, divisor: 6 };
  const shinboManuf = shinboFormula['제조'] || { sales_min: 30000, divisor: 4 };
  const shinboFranchise = shinboFormula['프랜차이즈요식'] || { sales_min: 50000, divisor: 6 };
  const shinboIsTypical = fShinbo?.criteria?.limit_formula_is_typical;
  if (jaedanActive || giboActive) {
    if (!shinboActive) {
      warnings.push(`⚠️ 이미 ${jaedanActive ? '신용보증재단' : '기보'} 이용 중 — 신용보증기금(신보) 신규 보증은 원칙적으로 불가 (대환 등 예외는 상담 필요)`);
    }
  } else if (fShinbo && canApply && shinboCanReapply && (!isRestaurant || isFranchiseFood)
      && ((isRetail && salesNum >= shinboRetail.sales_min) || (isManuf && salesNum >= shinboManuf.sales_min) || (isFranchiseFood && salesNum >= shinboFranchise.sales_min))) {
    const divisor = isManuf ? shinboManuf.divisor : (isFranchiseFood ? shinboFranchise.divisor : shinboRetail.divisor);
    const shinboLimit = Math.floor(salesNum / divisor);
    results.push({
      tag: '간접대출 (보증)',
      name: fShinbo.name,
      limit: `${shinboIsTypical ? '통상 ' : ''}최대 ${shinboLimit.toLocaleString()}만원`,
      rate: fShinbo.rate_note,
      period: fShinbo.period_note,
      condition: `매출 ÷ ${divisor} = ${shinboLimit.toLocaleString()}만원${shinboIsTypical ? ' (통상 수준 — 실제 한도는 심사에 따라 달라질 수 있음)' : ''} ※ 재단/신보/기보 중 1개만 선택`,
      color: '#2e7d32',
      cap: null,
    });
  }
  if (isRestaurant && !isFranchiseFood) {
    checks.push('ℹ️ 신용보증기금·기술보증기금은 요식업 특성상 대상 업종이 아닙니다 (프랜차이즈·가맹점은 별도 검토 가능)');
  }

  // 기보: 핵심 조건은 특허보유 또는 대표자 경력 10년 이상 (매출/업종 기준 아님).
  // 한도는 매출·기술력 등에 따라 보증 심사 시 결정되므로 특정 금액을 미리 계산해 보여주지 않습니다.
  const giboCareerYearsMin = fGibo?.criteria?.requires_patent_or_career_years ?? 10;
  const giboCore = [];
  if (hasPatent) giboCore.push('특허보유');
  if (careerYears >= giboCareerYearsMin) giboCore.push(`대표자 경력 ${careerYears}년`);
  if (isRestaurant && !isFranchiseFood) {
    // 일반 식당은 원칙적으로 대상 아님 — 별도 안내 없이 결과에서 제외
  } else if (jaedanActive || shinboActive) {
    if (!giboActive) {
      warnings.push(`⚠️ 이미 ${jaedanActive ? '신용보증재단' : '신보'} 이용 중 — 기술보증기금(기보) 신규 보증은 원칙적으로 불가 (대환 등 예외는 상담 필요)`);
    }
  } else if (fGibo && canApply && giboCanReapply && giboCore.length > 0) {
    results.push({
      tag: '간접대출 (보증)',
      name: fGibo.name,
      limit: '보증 심사 시 결정',
      rate: fGibo.rate_note,
      period: fGibo.period_note,
      condition: `충족 요건: ${giboCore.join(', ')} ※ 재단/신보/기보 중 1개만 선택, 한도는 매출·기술력 등을 종합해 심사 시 결정`,
      color: '#6a1b9a',
      cap: null,
    });
  } else if (fGibo && canApply && giboCore.length === 0) {
    checks.push(`ℹ️ ${fGibo.name} — 특허보유 또는 대표자 경력 ${giboCareerYearsMin}년 이상 조건 확인 필요`);
  }

  // 중진공: 마스터 DB에 자금 항목이 있지만 소상공인 대상 자동판정은 아직 미구현 — 상담 필요로만 안내
  if (canApply) {
    checks.push('ℹ️ 중진공(중소벤처기업진흥공단) — 기준 확인 필요, 상담 시 별도 검토');
  }

  const hasSojingongResult = results.some((r) => r.tag === '소진공 직접대출');
  const hasGuaranteeResult = results.some((r) => r.tag === '간접대출 (보증)');
  if (hasSojingongResult && hasGuaranteeResult) {
    checks.push('💡 소진공 직접대출(직접대출)과 재단·신보·기보(간접대출/보증)는 서로 다른 방식이라 타이밍만 맞으면 함께 진행 가능합니다 — 진행 순서는 상담에서 안내해드립니다.');
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
