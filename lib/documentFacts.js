// lib/documentFacts.js
// 서류발급(CODEF)으로 받아온 원본 응답(codef_auth_sessions.result_payload)에서
// 자격판정에 쓰이는 사실값을 뽑아내는 모듈.
//
// 2단계 자격 자동판정의 원칙: 자금진단 입력값(CRM에 컨설턴트가 입력한 값)이 主, 서류 데이터는
// 그 입력값을 자동으로 채우고 검증하는 보조. 서류만으로 판정하지 않음(직원 수·기존 대출 잔액·
// 스마트기기 등은 서류에 없음). 그래서 이 모듈은 "사실값 + CRM값과의 비교(불일치)"만 돌려주고,
// 실제 CRM 갱신은 컨설턴트가 화면에서 '적용'을 눌러야 일어남.
//
// 서류별로 뽑는 것:
//   사업자등록증명(corporate-registration): 개업일 → 업력, 업태/종목
//   부가세과세표준증명(additional-tax-standard): 과세기간별 (과세 총금액 + 면세) → 연도별 매출, 최근 완결연도 연매출
//   납세증명서(tax-payment-certificate): 납세상태/체납내역 → 국세 체납 여부
//   지방세 납세증명서(localtax-payment-certificate): 발급 성공 = 체납 없음(체납 있으면 발급 안 됨), 징수유예 내역
//   재무제표(financial-statement): 손익계산서 매출액, 대차대조표 부채총계·자본총계 (항목명 퍼지 매칭)
//   사업자 이력(사업자등록증명 + 부가세과세표준증명 대조): 사업자등록증명은 폐업하면 발급 자체가 안 돼서 살아있는
//   사업자만 나오고, 부가세과세표준증명은 과거 신고 이력이라 폐업한 사업자 것도 나옴 — 두 목록을 사업자등록번호로
//   대조하면 별도 CODEF 상품(폐업사실증명, 아직 CODEF에 없음) 없이도 "폐업 이력 있음 / 현재 사업자 개수"를 뽑아낼
//   수 있음. 재도전특별자금(hasBankruptcy·currentBizCount 조건)에 바로 씀.
// 금액은 CODEF가 '원' 단위 문자열로 주므로 만원으로 환산해서 돌려줌 (CRM revenue_amount도 만원).

import { sql } from '@/lib/db'

const PRODUCTS = ['corporate-registration', 'additional-tax-standard', 'tax-payment-certificate', 'localtax-payment-certificate', 'financial-statement']

const toManwon = (won) => {
  const n = Number(String(won ?? '').replace(/[^0-9.-]/g, ''))
  if (!Number.isFinite(n) || n === 0) return 0
  return Math.round(n / 10000)
}
const parseYmd = (s) => {
  if (!s || String(s).length < 8) return null
  const str = String(s)
  const d = new Date(`${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`)
  return Number.isNaN(d.getTime()) ? null : d
}
const yearsBetween = (from, to = new Date()) => {
  if (!from) return null
  const ms = to - from
  return Math.round((ms / (365.25 * 24 * 3600 * 1000)) * 10) / 10
}
const items = (payload) => {
  const d = payload?.data
  if (Array.isArray(d)) return d
  if (d && typeof d === 'object') return [d]
  return []
}
const cleanPlus = (s) => (s ? String(s).replaceAll('+', ' ').trim() : '')

// 최신 확정 세션을 상품별로 1건씩. 고객 CRM에 사업자등록번호가 있으면 그 번호로 발급된 것만 채택
// (테스트 고객처럼 한 고객 밑에 여러 상호의 서류가 섞여 있을 때 다른 회사 서류로 판정하지 않게).
async function latestConfirmedSessions(customerId, bizRegNo) {
  const rows = await sql`
    SELECT product, result_payload, created_at
    FROM codef_auth_sessions
    WHERE customer_id = ${customerId} AND status = 'confirmed'
    ORDER BY created_at DESC
  `
  const want = bizRegNo ? String(bizRegNo).replace(/[^0-9]/g, '') : null
  const byProduct = {}
  for (const r of rows) {
    if (byProduct[r.product]) continue
    if (want) {
      const no = String(items(r.result_payload)[0]?.resCompanyIdentityNo || '').replace(/[^0-9]/g, '')
      if (no && no !== want) continue
    }
    byProduct[r.product] = r
  }
  return byProduct
}

// 최신 확정 세션 1건 (상품 지정, bizRegNo 필터 없음) — 사업자 이력 대조처럼 "그 고객 밑의 모든 회사"를
// 봐야 하는 경우에 씀. latestConfirmedSessions()의 bizRegNo 필터는 회사 하나만 콕 집을 때 쓰는 것이라
// 사업자 이력 대조 목적과는 반대라 별도로 둠.
async function rawLatestSession(customerId, product) {
  const [row] = await sql`
    SELECT result_payload, created_at FROM codef_auth_sessions
    WHERE customer_id = ${customerId} AND product = ${product} AND status = 'confirmed'
    ORDER BY created_at DESC LIMIT 1
  `
  return row || null
}

function extractRegistration(payload) {
  const it = items(payload)[0]
  if (!it) return null
  const openDate = parseYmd(it.resOpenDate) || parseYmd(it.resRegisterDate)
  return {
    openDate: openDate ? openDate.toISOString().slice(0, 10) : null,
    bizAgeYears: yearsBetween(openDate),
    businessTypes: cleanPlus(it.resBusinessTypes),
    businessItems: cleanPlus(it.resBusinessItems),
    industryText: [cleanPlus(it.resBusinessTypes), cleanPlus(it.resBusinessItems)].filter(Boolean).join(' / '),
    companyName: it.resCompanyNm || it.resUserNm || null,
    bizRegNo: it.resCompanyIdentityNo || null,
  }
}

// 사업자등록증명(활성 사업자만 발급됨) vs 부가세과세표준증명(폐업 여부 무관하게 신고 이력 있으면 나옴)의
// 사업자등록번호 목록을 대조 — 부가세 목록에만 있는 회사 = 과거 폐업. CODEF의 별도 폐업사실증명 상품 없이도
// 재도전특별자금의 "폐업 이력 있음 + 현재 사업자 1개" 조건 판정에 바로 쓸 수 있음.
function extractBusinessHistory(vatPayload, registrationPayload) {
  const vatItems = items(vatPayload)
  const regItems = items(registrationPayload)
  if (vatItems.length === 0 && regItems.length === 0) return null

  const activeNos = new Set(regItems.map((it) => String(it.resCompanyIdentityNo || '').replace(/[^0-9]/g, '')).filter(Boolean))
  const byNo = {}
  for (const it of vatItems) {
    const no = String(it.resCompanyIdentityNo || '').replace(/[^0-9]/g, '')
    const key = no || `이름:${it.resCompanyNm || '상호 미확인'}` // 사업자번호가 안 잡히면 상호로라도 구분
    if (!byNo[key]) byNo[key] = { bizRegNo: no || null, name: it.resCompanyNm || '상호 미확인', active: no ? activeNos.has(no) : false }
  }
  // 사업자등록증명엔 있는데 부가세 목록엔 없는 경우(막 개업해서 아직 부가세 신고 이력이 없는 등)도 놓치지 않게 추가
  for (const it of regItems) {
    const no = String(it.resCompanyIdentityNo || '').replace(/[^0-9]/g, '')
    const key = no || `이름:${it.resCompanyNm || it.resUserNm || '상호 미확인'}`
    if (!byNo[key]) byNo[key] = { bizRegNo: no || null, name: it.resCompanyNm || it.resUserNm || '상호 미확인', active: true }
  }

  const businesses = Object.values(byNo)
  const activeCount = businesses.filter((b) => b.active).length
  const closedCount = businesses.length - activeCount
  return {
    businesses,
    totalCount: businesses.length,
    activeCount,
    closedCount,
    hasClosureHistory: closedCount > 0,
    // 두 서류가 다 있어야 활성/폐업을 구분할 수 있음 — 하나만 있으면 폐업 여부는 알 수 없고 개수만 참고
    reliable: vatItems.length > 0 && regItems.length > 0,
  }
}

function extractVat(payload) {
  const list = items(payload)
  if (list.length === 0) return null
  // 연도별 합산 (반기 신고 등 여러 과세기간이 같은 연도에 있을 수 있음)
  const byYear = {}
  for (const it of list) {
    const year = String(it.commStartDate || it.resAttrYear || '').slice(0, 4)
    if (!year) continue
    const taxable = toManwon(it.resIncomeTotalAmt)
    const dutyFree = toManwon(it.resDutyFreeAmt)
    if (!byYear[year]) byYear[year] = { year, taxable: 0, dutyFree: 0, total: 0, periods: [] }
    byYear[year].taxable += taxable
    byYear[year].dutyFree += dutyFree
    byYear[year].total += taxable + dutyFree
    if (it.commStartDate && it.commEndDate) byYear[year].periods.push(`${it.commStartDate}~${it.commEndDate}`)
  }
  const years = Object.values(byYear).sort((a, b) => Number(b.year) - Number(a.year))
  // "최근 완결 연도" = 올해가 아닌 가장 최근 연도 (올해는 아직 진행 중이라 연매출로 못 씀)
  const thisYear = String(new Date().getFullYear())
  const latestFull = years.find((y) => y.year !== thisYear) || years[0] || null
  return {
    byYear: years,
    latestFullYear: latestFull ? latestFull.year : null,
    annualSales: latestFull ? latestFull.total : null, // 만원
  }
}

function extractNationalTax(payload) {
  const it = items(payload)[0]
  if (!it) return null
  const arrears = Array.isArray(it.resArrearsList) ? it.resArrearsList.filter((a) => a.resTaxItemName) : []
  const status = it.resPaymentTaxStatus || null
  // 납세증명서는 체납이 없을 때 발급되는 게 원칙. '해당없음' 또는 체납내역 비어있으면 체납 없음으로 판단.
  const delinquent = arrears.length > 0 ? true : status ? status !== '해당없음' && status.includes('체납') : false
  return {
    status,
    delinquent,
    arrears: arrears.map((a) => ({ item: a.resTaxItemName, amountManwon: toManwon(a.resLocalTaxAmt) })),
    validUntil: it.resValidPeriod || null,
  }
}

function extractLocalTax(payload) {
  const it = items(payload)[0]
  if (!it) return null
  const respites = Array.isArray(it.resRespiteList) ? it.resRespiteList.filter((r) => r.resTaxItemName) : []
  // 지방세 납세증명서는 체납이 있으면 발급 자체가 안 됨 → 발급 성공 = 체납 없음
  return {
    delinquent: false,
    respites: respites.map((r) => ({ item: r.resTaxItemName, amountManwon: toManwon(r.resLocalTaxAmt) })),
    validUntil: it.resValidPeriod || null,
  }
}

function findRow(rows, keywords) {
  if (!Array.isArray(rows)) return null
  for (const kw of keywords) {
    const hit = rows.find((r) => r && r._title && String(r._title).replace(/\s/g, '').includes(kw))
    if (hit) return hit
  }
  return null
}
function rowAmount(row) {
  if (!row) return null
  // 항목 행의 금액 필드명이 응답마다 달라서 숫자로 보이는 첫 필드를 사용 (FinancialTable도 같은 방식으로 표시 중)
  for (const k of ['resAccountAmt', 'resAmt', 'amount', 'resCurrentAmt', 'resThisTermAmt']) {
    if (row[k] != null && row[k] !== '') return toManwon(row[k])
  }
  for (const [k, v] of Object.entries(row)) {
    if (k === '_title' || k === 'code' || k === 'resAccountCode') continue
    const n = Number(String(v).replace(/[^0-9.-]/g, ''))
    if (Number.isFinite(n) && n !== 0 && String(v).replace(/[^0-9]/g, '').length >= 4) return toManwon(v)
  }
  return null
}

function extractFinancial(payload) {
  const list = items(payload)
  if (list.length === 0) return null
  const it = [...list].sort((a, b) => Number(b.resAttrYear || 0) - Number(a.resAttrYear || 0))[0]
  const isRow = findRow(it.resIncomeStatement, ['매출액', '매출'])
  const debtRow = findRow(it.resBalanceSheet, ['부채총계'])
  const equityRow = findRow(it.resBalanceSheet, ['자본총계'])
  const assetRow = findRow(it.resBalanceSheet, ['자산총계'])
  const sales = rowAmount(isRow)
  const totalDebt = rowAmount(debtRow)
  const totalEquity = rowAmount(equityRow)
  const totalAssets = rowAmount(assetRow)
  return {
    attrYear: it.resAttrYear || null,
    sales, // 만원
    totalDebt,
    totalEquity,
    totalAssets,
    debtRatioPct: totalDebt != null && totalEquity ? Math.round((totalDebt / totalEquity) * 1000) / 10 : null,
    hasStatements: !!(it.resIncomeStatement?.length || it.resBalanceSheet?.length),
  }
}

export async function getDocumentFacts(customerId, bizRegNo = null) {
  const sessions = await latestConfirmedSessions(customerId, bizRegNo)
  const facts = { sources: {} }
  for (const p of PRODUCTS) {
    if (!sessions[p]) continue
    facts.sources[p] = sessions[p].created_at
  }
  if (sessions['corporate-registration']) facts.registration = extractRegistration(sessions['corporate-registration'].result_payload)
  if (sessions['additional-tax-standard']) facts.vat = extractVat(sessions['additional-tax-standard'].result_payload)
  if (sessions['tax-payment-certificate']) facts.nationalTax = extractNationalTax(sessions['tax-payment-certificate'].result_payload)
  if (sessions['localtax-payment-certificate']) facts.localTax = extractLocalTax(sessions['localtax-payment-certificate'].result_payload)
  if (sessions['financial-statement']) facts.financial = extractFinancial(sessions['financial-statement'].result_payload)

  // 사업자 이력은 "그 고객의 모든 회사"를 봐야 해서 latestConfirmedSessions의 bizRegNo 필터를 안 거친
  // 원본 세션을 따로 가져옴 (필터를 거치면 폐업한 회사가 걸러져 사라질 수 있음).
  const [rawVat, rawReg] = await Promise.all([
    rawLatestSession(customerId, 'additional-tax-standard'),
    rawLatestSession(customerId, 'corporate-registration'),
  ])
  if (rawVat || rawReg) {
    facts.businessHistory = extractBusinessHistory(rawVat?.result_payload, rawReg?.result_payload)
  }
  return facts
}

// CRM 값과 서류 사실값을 비교해 "채울 수 있는 것 / 불일치" 목록을 만든다.
// 각 항목: { field, label, crmValue, docValue, docSource, status: 'match' | 'mismatch' | 'fill' | 'doc_only' }
//   fill      = CRM이 비어 있고 서류에 값이 있음 → 바로 채우기 권장
//   mismatch  = 둘 다 있는데 다름 → 컨설턴트가 확인 후 적용
//   match     = 일치
export function compareWithCustomer(facts, customer) {
  const out = []
  const pfd = customer?.policy_fund_details || {}

  if (facts.registration?.bizAgeYears != null) {
    // 업력은 서류(개업일)가 더 정확하므로 비교하지 않고 자동 적용됨(document-facts GET에서 CRM 갱신). 여기선 적용 결과만 알려줌.
    const doc = facts.registration.bizAgeYears
    out.push({
      field: 'businessAgeYears', label: '업력', crmValue: null, docValue: `${doc}년 (개업일 ${facts.registration.openDate || '-'})`,
      docSource: '사업자등록증명 — 자동 적용됨', status: 'applied',
    })
  }
  if (facts.registration?.industryText) {
    const crm = customer?.industry || null
    out.push({
      field: 'industry', label: '업종(업태/종목)', crmValue: crm, docValue: facts.registration.industryText, docSource: '사업자등록증명',
      status: !crm ? 'fill' : 'doc_only', // 업종은 CRM이 분류형(예: 도소매업)이고 서류는 세부 종목이라 자동 비교 안 함 — 참고용
    })
  }
  if (facts.vat?.annualSales != null) {
    const crm = customer?.revenue_amount != null ? Number(customer.revenue_amount) : null
    const doc = facts.vat.annualSales
    const diffPct = crm ? Math.abs(crm - doc) / crm : null
    out.push({
      field: 'revenueAmount', label: `연매출 (${facts.vat.latestFullYear}년)`, crmValue: crm == null ? null : `${crm.toLocaleString()}만원`, docValue: `${doc.toLocaleString()}만원`, rawValue: doc,
      docSource: '부가세과세표준증명 (과세+면세 합산)',
      status: crm == null || crm === 0 ? 'fill' : diffPct > 0.1 ? 'mismatch' : 'match',
    })
  } else if (facts.financial?.sales != null) {
    const crm = customer?.revenue_amount != null ? Number(customer.revenue_amount) : null
    const doc = facts.financial.sales
    out.push({
      field: 'revenueAmount', label: `연매출 (${facts.financial.attrYear}년 재무제표)`, crmValue: crm == null ? null : `${crm.toLocaleString()}만원`, docValue: `${doc.toLocaleString()}만원`, rawValue: doc,
      docSource: '재무제표 손익계산서 매출액',
      status: crm == null || crm === 0 ? 'fill' : Math.abs(crm - doc) / crm > 0.1 ? 'mismatch' : 'match',
    })
  }
  if (facts.nationalTax) {
    const crm = pfd.taxDelinquent === 'yes' ? true : pfd.taxDelinquent === 'no' ? false : null
    const doc = facts.nationalTax.delinquent
    out.push({
      field: 'taxDelinquent', label: '국세 체납', crmValue: crm == null ? null : crm ? '있음' : '없음', docValue: doc ? '있음' : '없음', docSource: '납세증명서(국세)',
      status: crm == null ? 'fill' : crm !== doc ? 'mismatch' : 'match',
      rawValue: doc ? 'yes' : 'no',
    })
  }
  if (facts.localTax) {
    out.push({
      field: 'localTaxDelinquent', label: '지방세 체납', crmValue: null, docValue: '없음 (증명서 발급됨)', docSource: '지방세 납세증명서',
      status: 'doc_only',
    })
  }
  if (facts.financial?.hasStatements) {
    out.push({
      field: 'financial', label: '재무제표', crmValue: null,
      docValue: [facts.financial.totalDebt != null ? `부채총계 ${facts.financial.totalDebt.toLocaleString()}만원` : null,
        facts.financial.totalEquity != null ? `자본총계 ${facts.financial.totalEquity.toLocaleString()}만원` : null,
        facts.financial.debtRatioPct != null ? `부채비율 ${facts.financial.debtRatioPct}%` : null].filter(Boolean).join(' · ') || '있음',
      docSource: `재무제표 ${facts.financial.attrYear || ''}`,
      status: 'doc_only',
    })
  }
  if (facts.businessHistory?.reliable) {
    const bh = facts.businessHistory
    // 폐업이력·현재 사업자 개수는 document-facts GET에서 이미 자동 반영됨(업력과 동일한 취급) —
    // 여기선 적용 결과만 보여줌. 재도전특별자금의 "현재 사업자 1개" 조건에 바로 쓰이는 값이라
    // 컨설턴트의 수동 클릭을 기다리지 않고 서류 확인 즉시 반영해야 자격판정이 어긋나지 않음.
    const detail = bh.businesses.map((b) => `${b.name}(${b.active ? '운영중' : '폐업'})`).join(', ')
    out.push({
      field: 'hasBankruptcy', label: '폐업 이력',
      crmValue: null, docValue: `${bh.hasClosureHistory ? '있음' : '없음'} — 총 ${bh.totalCount}개 사업자 등록 이력 중 운영중 ${bh.activeCount}개·폐업 ${bh.closedCount}개 (${detail})`,
      docSource: '사업자등록증명 vs 부가세과세표준증명 사업자 목록 대조 — 자동 적용됨', status: 'applied',
    })
    if (bh.activeCount > 0) {
      out.push({
        field: 'currentBizCount', label: '현재 운영중인 사업자 개수',
        crmValue: null, docValue: `${bh.activeCount}개`,
        docSource: '사업자등록증명(현재 운영중인 사업자 수) — 자동 적용됨', status: 'applied',
      })
    }
  }
  return out
}
