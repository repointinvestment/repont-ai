// lib/policyFundVerdict.js
// 2단계 자격 자동판정의 "결과 형식 개편".
// 대표 철학(마스터 DB 공통규칙 application_philosophy): 자금은 정답이 없고 기준·매출 경계선만 있다.
// 그래서 가능/불가로 자르지 않고 "어느 기관에 어떤 자금으로 접수를 넣을 수 있는가 + 근거 + 최종 결정 4요소
// (기존 부채·매출·재무제표·신용점수) 상태"를 보여준다. 컨설턴트가 접수를 아예 안 넣는 실수를 막는 게 목적.
//
// 입력: analyzePolicyFunds() 결과(analysis), 진단 입력(form), 마스터 DB(fundsByKey/rulesByKey), 서류 사실값(docFacts, 선택)
// 출력: { institutions: [...], factors: {...}, docChecks: [...] }
//   institutions[i] = { key, name, status: '접수 가능' | '조건부' | '현재 불가' | '확인 필요', funds: [{name, limit, condition}], reasons: [], caveats: [] }

const fmtWon = (v) => (v == null ? '-' : v >= 10000 ? `${(v / 10000).toLocaleString()}억` : `${v.toLocaleString()}만원`)

export function buildVerdict({ analysis, form, fundsByKey = {}, rulesByKey = {}, docFacts = null }) {
  const num = (v) => Number(String(v ?? '').replace(/[^0-9.-]/g, '')) || 0
  const results = analysis?.results || []
  const warnings = analysis?.warnings || []
  const checks = analysis?.checks || []

  const byTag = (tag) => results.filter((r) => r.tag === tag)
  const sojinkongFunds = byTag('소진공 직접대출')
  const guaranteeFunds = byTag('간접대출 (보증)')
  const has = (name) => guaranteeFunds.find((r) => r.name?.includes(name))
  const warnHas = (kw) => warnings.filter((w) => w.includes(kw))

  const salesNum = num(form?.sales)
  const bizAge = num(form?.bizAge)
  const creditScore = num(form?.creditKCB) || num(form?.creditNICE)
  const taxDelinquent = form?.taxDelinquent === 'yes'
  const employees = num(form?.employees)

  const loans = form?.loans || {}
  const jaedanLoan = num(loans.jaedan), shinboLoan = num(loans.shinbo), giboLoan = num(loans.gibo)

  // ── 공통 차단 사유(모든 기관에 걸리는 것) ──
  const hardBlocks = []
  if (taxDelinquent) hardBlocks.push('국세·지방세 체납 중 — 체납 해소 전에는 어느 기관도 접수 불가')
  const empWarn = warnHas('소상공인 상한')
  if (empWarn.length) hardBlocks.push('소상공인 직원 수 상한 초과 — 소진공·재단은 불가, 대신 중진공(중소기업) 대상 검토')
  const debtWarn = warnHas('매출초과차입금')
  if (debtWarn.length) hardBlocks.push('업력 7년 이상 + 사업자대출이 매출 초과 — 소진공 기준 불가, 보증기관은 심사에서 불리')

  const institutions = []

  // 소진공
  {
    const reasons = [], caveats = []
    let status
    if (taxDelinquent) { status = '현재 불가'; reasons.push('체납') }
    else if (empWarn.length) { status = '현재 불가'; reasons.push('소상공인 직원 수 상한 초과') }
    else if (debtWarn.length) { status = '현재 불가'; reasons.push('매출초과차입금 기준 초과') }
    else if (sojinkongFunds.length > 0) {
      status = '접수 가능'
      reasons.push(`조건 충족 자금 ${sojinkongFunds.length}개 · 잔여 총한도 ${fmtWon(analysis.sojingongRemain)}`)
      caveats.push('소진공 직접대출은 심사 결과 나올 때까지 한 번에 1개만 접수')
    } else {
      status = '조건부'
      const smart = checks.find((c) => c.includes('스마트기기'))
      if (smart) reasons.push('스마트기기 도입하면 혁신성장촉진자금 대상')
      if (analysis.sojingongRemain <= 0) reasons.push('소진공 총한도 소진')
      if (!reasons.length) reasons.push('재도전·신용취약·일시적경영애로 요건 추가 확인 필요')
    }
    institutions.push({ key: 'sojinkong', name: '소진공 (직접대출)', status, funds: sojinkongFunds.map(pick), reasons, caveats })
  }

  // 재단
  {
    const reasons = [], caveats = []
    let status
    const f = has('신용보증재단')
    if (taxDelinquent) { status = '현재 불가'; reasons.push('체납') }
    else if (f) { status = '접수 가능'; reasons.push(f.condition) }
    else if (warnHas('신용보증재단 신규 보증은 원칙적으로 불가').length) {
      status = '조건부'
      reasons.push(shinboLoan > 0 ? '신보 이용 중 — 같은 신용보증 계열이라 재단 추가 사례 있음(매출 17억 대표: 신보 3억+재단 1억), 재단 한도 미사용이면 접수 시도' : '기보 이용 중 — 재단과 기보는 공동 보유 불가, 대환 형태만')
    }
    else if (warnHas('재단 재신청 불가').length) { status = '조건부'; reasons.push(warnHas('재단 재신청 불가')[0].replace('⚠️ ', '')) }
    else if (jaedanLoan >= (fundsByKey.jaedan?.limit_operating ?? 10000)) { status = '현재 불가'; reasons.push('재단 한도 1억 소진') }
    else { status = '확인 필요'; reasons.push('재단은 매출 무관하게 한도 미사용이면 검토 대상 — 입력값 확인') }
    if (status === '접수 가능' && sojinkongFunds.length) caveats.push('소진공 직접대출과 동시 진행 가능(①소진공 접수→②재단 접수→③보증서 수령→④소진공 약정→⑤은행 실행)')
    institutions.push({ key: 'jaedan', name: '신용보증재단 (보증)', status, funds: f ? [pick(f)] : [], reasons, caveats })
  }

  // 신보
  {
    const reasons = [], caveats = []
    let status
    const f = has('신용보증기금')
    const isFood = /음식|요식|카페|외식/.test(form?.industry || '') && !form?.isFranchise
    if (taxDelinquent) { status = '현재 불가'; reasons.push('체납') }
    else if (f) { status = '접수 가능'; reasons.push(f.condition); caveats.push('한도 공식(÷6, ÷4)은 통상 수준 — 실제는 심사(재무·신용)로 결정') }
    else if (isFood) { status = '현재 불가'; reasons.push('비프랜차이즈 요식업 — 신보의 유일한 업종 예외') }
    else if (giboLoan > 0) { status = '현재 불가'; reasons.push('기보 이용 중 — 신보↔기보 무조건 동시 불가, 대환만(매우 어려움)') }
    else if (jaedanLoan > 0 && salesNum >= 50000) { status = '조건부'; reasons.push('재단 이용 중이지만 매출 규모가 되면 신보가 재단 대출을 대환하며 올라가는 경우 있음 — 대표 보고 후 진행') }
    else if (warnHas('신용보증기금 재신청 불가').length) { status = '조건부'; reasons.push(warnHas('신용보증기금 재신청 불가')[0].replace('⚠️ ', '')) }
    else {
      status = '조건부'
      const lf = fundsByKey.shinbo?.criteria?.limit_formula || {}
      const minRetail = lf['도소매서비스']?.sales_min ?? 50000, minManuf = lf['제조']?.sales_min ?? 30000
      reasons.push(`매출 참고선 미달(도소매·서비스 ${fmtWon(minRetail)}↑ / 제조 ${fmtWon(minManuf)}↑) — 참고선일 뿐 확정 기준 아님, 재무제표 좋으면 접수 시도 가능`)
    }
    institutions.push({ key: 'shinbo', name: '신용보증기금 (신보)', status, funds: f ? [pick(f)] : [], reasons, caveats })
  }

  // 기보
  {
    const reasons = [], caveats = []
    let status
    const f = has('기술보증기금')
    const isFood = /음식|요식|카페|외식/.test(form?.industry || '') && !form?.isFranchise
    const hasPatent = !!form?.hasPatent
    const career = num(form?.careerYears)
    const careerMin = fundsByKey.gibo?.criteria?.requires_patent_or_career_years ?? 10
    if (taxDelinquent) { status = '현재 불가'; reasons.push('체납') }
    else if (f) { status = '접수 가능'; reasons.push(f.condition); caveats.push('기보는 비재무(특허·연구소·경력·기술)를 재무보다 더 봄 — 기술 자료 준비가 핵심') }
    else if (isFood) { status = '현재 불가'; reasons.push('비프랜차이즈 요식업 — 기보의 유일한 업종 예외') }
    else if (shinboLoan > 0) { status = '현재 불가'; reasons.push('신보 이용 중 — 신보↔기보 무조건 동시 불가') }
    else if (jaedanLoan > 0) { status = '조건부'; reasons.push('재단 이용 중 — 기보가 안 해줄 때 많지만 규모·기술·특허·경력 좋으면 재단 대환 후 추가 사례 있음') }
    else if (!hasPatent && career < careerMin) { status = '조건부'; reasons.push(`특허 없음 + 대표 경력 ${career || 0}년 (${careerMin}년 미만) — 기술력·인증 자료 있으면 접수 시도 가능`) }
    else if (warnHas('기술보증기금 재신청 불가').length) { status = '조건부'; reasons.push(warnHas('기술보증기금 재신청 불가')[0].replace('⚠️ ', '')) }
    else { status = '확인 필요'; reasons.push('입력값 확인 필요') }
    institutions.push({ key: 'gibo', name: '기술보증기금 (기보)', status, funds: f ? [pick(f)] : [], reasons, caveats })
  }

  // 중진공 — 소상공인 규모를 넘으면 오히려 여기가 주 대상. 자동판정은 아직 규모·업력 힌트 수준.
  {
    const reasons = [], caveats = []
    let status
    const rule = rulesByKey.jungjingong_general
    const th = rule?.params?.small_business_threshold || { '광업·제조·건설·운수': 10, '기타': 5 }
    const isManufLike = /제조|건설|운수|광업/.test(form?.industry || '')
    const threshold = isManufLike ? th['광업·제조·건설·운수'] : th['기타']
    if (taxDelinquent) { status = '현재 불가'; reasons.push('체납') }
    else if (employees >= threshold) {
      status = '접수 가능'
      reasons.push(`직원 ${employees}명 — 소상공인 규모 초과(중진공 기준 ${threshold}명↑)라 중소기업 정책자금 대상. 업력 ${bizAge}년 → ${bizAge < 7 ? '혁신창업사업화자금(창업기반지원)' : '신성장기반자금(혁신성장지원)'} 트랙`)
      caveats.push('매출 클수록 유리, 기술력 평가. 소상공인 시절 소진공 혁신성장촉진자금 받았으면 마일스톤자금 경로')
    } else if (employees > 0 && employees >= threshold - 1) {
      status = '조건부'
      reasons.push(`직원 ${employees}명 — 1명만 더 고용하면 중진공 대상(${threshold}명↑). 소진공 혁신성장촉진자금 이력 있으면 마일스톤자금 검토`)
    } else {
      status = '조건부'
      reasons.push('소상공인 규모 — 원칙 제외. 예외: 혁신성장·신산업 분야, 청년(만 39세 이하) 창업, 신시장진출(수출), 마일스톤자금')
    }
    institutions.push({ key: 'kosme', name: '중진공 (중소기업 정책자금)', status, funds: [], reasons, caveats })
  }

  // ── 최종 결정 4요소 ──
  const totalBizLoan = analysis?.totalBizLoan ?? 0
  const factors = {
    debt: {
      label: '기존 부채',
      value: `사업자대출 ${fmtWon(totalBizLoan)}${analysis?.totalPersonalLoan ? ` · 개인대출 ${fmtWon(analysis.totalPersonalLoan)}` : ''}`,
      assessment: debtWarn.length ? '매출 초과 — 불리' : bizAge >= 7 ? `매출초과차입금 여유 ${fmtWon(analysis?.remainingCapacity)}` : '업력 7년 미만 — 매출초과 기준 미적용',
      level: debtWarn.length ? 'bad' : totalBizLoan > salesNum * 0.7 ? 'warn' : 'good',
    },
    sales: {
      label: '매출',
      value: fmtWon(salesNum),
      assessment: salesNum >= 50000 ? '신보 참고선(5억) 이상' : salesNum >= 30000 ? '제조업이면 신보 참고선(3억) 이상' : salesNum > 0 ? '재단·소진공 규모' : '미입력',
      level: salesNum >= 30000 ? 'good' : salesNum > 0 ? 'warn' : 'bad',
      docNote: docFacts?.vat?.annualSales != null ? `서류(부가세증명 ${docFacts.vat.latestFullYear}년): ${fmtWon(docFacts.vat.annualSales)}` : null,
    },
    financial: {
      label: '재무제표',
      value: docFacts?.financial?.hasStatements ? `있음 (${docFacts.financial.attrYear}년)` : '미확인',
      assessment: docFacts?.financial?.debtRatioPct != null ? `부채비율 ${docFacts.financial.debtRatioPct}%` : docFacts?.financial?.hasStatements ? '부채총계·자본총계 확인' : '서류발급에서 재무제표 조회 시 자동 반영 (간편장부대상자는 없을 수 있음)',
      level: docFacts?.financial?.debtRatioPct != null ? (docFacts.financial.debtRatioPct > 400 ? 'bad' : docFacts.financial.debtRatioPct > 250 ? 'warn' : 'good') : 'unknown',
    },
    credit: {
      label: '신용점수',
      value: creditScore ? `${creditScore}점` : '미입력',
      assessment: !creditScore ? '입력 필요' : creditScore >= 840 ? '양호 (신용취약자금 대상은 아님)' : creditScore >= 700 ? '보통 (혁신형 실전 권장선 700↑ 충족)' : creditScore >= 595 ? '신용취약소상공인자금 구간 (595~839)' : '595점 미달 — 정책자금 전반 어려움',
      level: !creditScore ? 'unknown' : creditScore >= 700 ? 'good' : creditScore >= 595 ? 'warn' : 'bad',
    },
  }

  return { institutions, factors, hardBlocks }
}

function pick(r) {
  return { name: r.name, limit: r.limit, condition: r.condition, rate: r.rate, period: r.period }
}
