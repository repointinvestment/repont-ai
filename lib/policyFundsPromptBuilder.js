// lib/policyFundsPromptBuilder.js
// app/api/chat/route.js의 시스템 프롬프트 중 "## 핵심 지식" 절을 마스터 DB(lib/policyFundsSeed.js 기반)에서
// 매 요청마다 동적으로 생성. "## [분석 순서]" 같은 상담 진행 방법론은 데이터가 아니므로 여기서 다루지 않고
// route.js에 정적으로 남겨둠 — 대표가 DB(관리자 화면 또는 Claude에게 말로 수정 요청)를 고치면 재배포 없이
// 다음 채팅 요청부터 바로 반영됨.
//
// 현재 상담 [분석 순서]가 다루는 범위(소진공 직접대출 6종 + 재단/신보/기보)만 대상으로 함 —
// 중진공 12개 자금은 아직 상담 흐름(STEP 1~8)에 안 엮여 있어 제외.

function fmtEok(manwon) {
  if (manwon == null) return null;
  return manwon % 10000 === 0 ? `${manwon / 10000}억` : `${manwon.toLocaleString()}만원`;
}

export function buildPolicyKnowledgeSection(funds = [], rules = []) {
  const byKey = {};
  for (const f of funds) byKey[f.key] = f;
  const rulesByKey = {};
  for (const r of rules) rulesByKey[r.key] = r;

  const employeeLimits = rulesByKey.small_business_employee_limit?.params?.limits || { '제조·건설·운수·광업': 9, '그 외': 4 };
  const debtRule = rulesByKey.debt_over_sales;
  const capGroups = rulesByKey.sojinkong_total_cap?.params?.cap_groups || {};

  const fHyuksinGeneral = byKey.sojinkong_hyuksin_general;
  const fHyuksinInnov = byKey.sojinkong_hyuksin_innovative;
  const fJaedoGeneral = byKey.sojinkong_jaedo_general;
  const fJaedoLeap = byKey.sojinkong_jaedo_leap;
  const fCreditVulnerable = byKey.sojinkong_credit_vulnerable;
  const fTempHardship = byKey.sojinkong_temporary_hardship;
  const fJaedan = byKey.jaedan;
  const fShinbo = byKey.shinbo;
  const fGibo = byKey.gibo;

  const smartDeviceList = (fHyuksinGeneral?.smart_devices || []).join(' | ');

  const lines = [];
  lines.push('## 핵심 지식');
  lines.push('');
  lines.push('### 소상공인 기준');
  lines.push(`- 제조·건설·운수·광업: 대표자 제외 4대보험 직원 ${employeeLimits['제조·건설·운수·광업'] ?? 9}명 이하`);
  lines.push(`- 그 외(도소매·음식점·서비스): 대표자 제외 4대보험 직원 ${employeeLimits['그 외'] ?? 4}명 이하`);
  lines.push('');
  lines.push('### 매출초과차입금 기준');
  const debtAge = debtRule?.params?.applies_from_biz_age ?? 7;
  lines.push(`- 업력 ${debtAge}년 미만: 적용 안 함 → 대출이 매출보다 많아도 가능`);
  lines.push(`- 업력 ${debtAge}년 이상: 매출 - 사업자대출 잔액 합계가 마이너스면 신청 불가`);
  lines.push('- 사업자대출 = 소진공+재단+신보+기보+사업자명의대출 (아파트담보·개인신용대출 제외)');
  lines.push('');
  lines.push('### 소진공 직접대출 한도');
  lines.push(`- 기본 총한도: ${fmtEok(capGroups['소진공_기본_1억'] ?? fHyuksinGeneral?.limit_operating)} (잔액 합산)`);
  lines.push(`- 혁신형·도약형: 총한도 ${fmtEok(capGroups['소진공_확장_2억'] ?? fHyuksinInnov?.limit_operating)} 별도 적용`);
  lines.push('- 남은 한도 = 총한도 - 현재 소진공 직접대출 잔액');
  lines.push('');
  lines.push('### 보증기관 중복 금지 (매우 중요)');
  lines.push('- 신용보증재단 / 신용보증기금(신보) / 기술보증기금(기보) 중 1개만 선택 가능. 동시 접수 절대 불가.');
  lines.push('- 신보와 기보도 동시 이용 불가. 단 대환(한 기관이 다른 기관 대출 갚아주고 추가대출)은 예외적으로 가능하나 복잡하므로 대표님께 보고 후 진행.');
  lines.push('');
  lines.push('### 보증기관 선택 기준');
  const shinboFormula = fShinbo?.criteria?.limit_formula || {};
  const shinboRetail = shinboFormula['도소매서비스'] || { sales_min: 50000, divisor: 6 };
  const shinboManuf = shinboFormula['제조'] || { sales_min: 30000, divisor: 4 };
  lines.push(`- 신용보증재단: 매출 ${fmtEok(shinboRetail.sales_min)} 미만 소상공인 대부분 해당, 한도 ${fmtEok(fJaedan?.limit_operating)}`);
  lines.push(`- 신보: 도소매 매출 ${fmtEok(shinboRetail.sales_min)} 이상(한도=매출÷${shinboRetail.divisor}), 제조업 매출 ${fmtEok(shinboManuf.sales_min)} 이상(한도=매출÷${shinboManuf.divisor})`);
  lines.push(`- 기보: 기술특허 보유 또는 ${fGibo?.criteria?.requires_patent_or_career_years ?? 10}년 이상 경력자`);
  lines.push('- 요식업·서비스업: 신보/기보 원칙적으로 해당 없음. 언급하지 말 것.');
  lines.push('');
  lines.push('### 신용보증재단 재신청 대기기간');
  const jaedanMonths = fJaedan?.reapply_rule?.months_by_region || { 수도권: 12, 지방: 6 };
  lines.push(`- 서울·경기: 마지막 보증 수령일로부터 ${jaedanMonths['수도권'] / 12}년 이상`);
  lines.push(`- 그 외 지역: ${jaedanMonths['지방']}개월 이상`);
  lines.push('- 재단 보증 있으면 → 반드시 먼저 "언제 받으셨나요? 서울/경기인가요?" 물어볼 것');
  lines.push('');
  lines.push('### 소진공 주요 직접대출 자금');
  lines.push('');
  if (fHyuksinGeneral) {
    lines.push(`**${fHyuksinGeneral.name} (운전 ${fmtEok(fHyuksinGeneral.limit_operating)}, 시설 ${fmtEok(fHyuksinGeneral.limit_facility)})**`);
    lines.push('- 아래 스마트기기 중 1개 이상 도입·운영 중이면 해당:');
    lines.push(`  ${smartDeviceList}`);
    if (fHyuksinGeneral.notes) lines.push(`- ${fHyuksinGeneral.notes}`);
    lines.push('');
  }
  if (fHyuksinInnov) {
    lines.push(`**${fHyuksinInnov.name} (운전 ${fmtEok(fHyuksinInnov.limit_operating)}, 시설 ${fmtEok(fHyuksinInnov.limit_facility)})**`);
    lines.push('아래 중 1개 해당:');
    const anyConds = (fHyuksinInnov.conditions || []).filter((c) => c.kind === 'any');
    anyConds.forEach((c, i) => lines.push(`${['①', '②', '③', '④', '⑤'][i] || '-'} ${c.text}`));
    if (fHyuksinInnov.notes) lines.push(fHyuksinInnov.notes);
    lines.push('');
  }
  if (fJaedoGeneral) {
    const cap = fJaedoGeneral.limit_operating;
    lines.push(`**${fJaedoGeneral.name} (${fmtEok(cap)})**`);
    lines.push(`- 현재 사업자 1개 + 업력 ${fJaedoGeneral.criteria?.max_biz_age_exclusive ?? 7}년 미만`);
    lines.push('- 폐업이력 있거나 업종전환/3개월 이상 휴업/매출감소로 사업장 이전 이력');
    lines.push('');
  }
  if (fJaedoLeap) {
    lines.push(`**${fJaedoLeap.name} (${fmtEok(fJaedoLeap.limit_operating)})**`);
    const anyConds = (fJaedoLeap.conditions || []).filter((c) => c.kind === 'any').map((c) => c.text);
    lines.push(`- 재창업 업력 ${fJaedoLeap.criteria?.min_biz_age ?? 2}~${fJaedoLeap.criteria?.max_biz_age_exclusive ?? 7}년 + 성실상환 + 아래 성장 요건 중 1개:`);
    lines.push(`  ${anyConds.join(' | ')}`);
    lines.push('');
  }
  if (fCreditVulnerable) {
    lines.push(`**${fCreditVulnerable.name} (${fmtEok(fCreditVulnerable.limit_operating)})**`);
    lines.push(`- NICE 신용점수 ${fCreditVulnerable.criteria?.credit_min ?? 595}~${fCreditVulnerable.criteria?.credit_max ?? 839}점 + 국세·지방세 체납 없음 + 연체 없음`);
    lines.push('');
  }
  if (fTempHardship) {
    lines.push(`**${fTempHardship.name} (${fmtEok(fTempHardship.limit_operating)})**`);
    lines.push(`- 연매출 ${fmtEok(fTempHardship.criteria?.sales_max_exclusive)} 미만 + 업력 ${fTempHardship.criteria?.max_biz_age_exclusive ?? 7}년 미만 + 매출 ${fTempHardship.criteria?.requires_sales_decline_pct ?? 15}% 이상 감소`);
    lines.push('- 다른 소진공 직접대출과 동시 진행 불가');
    lines.push('');
  }

  return lines.join('\n');
}
