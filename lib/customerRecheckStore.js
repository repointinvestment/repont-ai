// lib/customerRecheckStore.js
// "구DB 관리시스템" 1단계 — 저장된 고객(부결·완료 포함 전체)을 주기적으로 다시 판정해서,
// 예전엔 안 됐는데 지금은 새로 뜨는 자금이 있으면 컨설턴트에게 알림. 완료된 고객도 여기서 계속 관리 대상에 남음
// (기존 팔로우업 위젯은 상담중·서류준비만 봐서 완료 고객이 레이더에서 빠지는 문제가 있었음).
//
// 판정에는 lib/policyFundAnalysis.js·lib/policyFundVerdict.js를 그대로 재사용 — 새 계산 로직 없음.
// "새로 생긴 매칭"은 직전에 저장해둔 매칭 자금 목록(customers.last_matched_fund_keys)과 비교해서 감지.

import { sql } from '@/lib/db'
import { analyzePolicyFunds } from '@/lib/policyFundAnalysis'
import { buildVerdict } from '@/lib/policyFundVerdict'

let schemaReady = false

export async function ensureSchema() {
  if (schemaReady) return
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN DEFAULT FALSE`
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS marketing_consent_at TIMESTAMPTZ`
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_matched_fund_keys JSONB DEFAULT '[]'::jsonb`
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_rechecked_at TIMESTAMPTZ`
  await sql`
    CREATE TABLE IF NOT EXISTS notification_log (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      channel TEXT NOT NULL, -- 'kakao' | 'sms'
      message TEXT,
      status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'sent' | 'failed'
      error TEXT,
      sent_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  schemaReady = true
}

function buildAnalysisForm(customer) {
  const pfd = customer.policy_fund_details || {}
  return {
    industry: customer.industry,
    bizAge: customer.business_age_years,
    sales: customer.revenue_amount,
    employees: customer.employee_count,
    creditKCB: customer.credit_kcb,
    creditNICE: customer.credit_nice,
    sojingongLoans: pfd.sojingongLoans,
    loans: pfd.loans,
    hasBankruptcy: pfd.hasBankruptcy,
    currentBizCount: pfd.currentBizCount,
    smartDevices: pfd.smartDevices,
    exportRecord: pfd.exportRecord,
    salesGrowth: pfd.salesGrowth,
    taxDelinquent: pfd.taxDelinquent,
    isFranchise: pfd.isFranchise,
    hasPatent: customer.has_patent,
    careerYears: customer.owner_career_years,
  }
}

// 한 고객을 재판정해서 "접수 가능"으로 뜨는 자금 키 목록을 뽑고, 직전 저장값과 비교.
// 반환: null(업력 등 필수정보 없어 판정 불가) 또는 { matchedNames, newNames, verdict }
export function recheckOne(customer, fundsByKey, rulesByKey) {
  const hasDetailedData = customer.business_age_years !== null && customer.business_age_years !== undefined
  if (!hasDetailedData) return null

  const form = buildAnalysisForm(customer)
  const analysis = analyzePolicyFunds(form, fundsByKey, rulesByKey)
  const verdict = buildVerdict({ analysis, form, fundsByKey, rulesByKey })

  const matchedNames = verdict.institutions
    .filter((i) => i.status === '접수 가능')
    .flatMap((i) => (i.funds || []).filter((f) => !f.status || f.status === '가능').map((f) => f.name))

  const prevNames = Array.isArray(customer.last_matched_fund_keys) ? customer.last_matched_fund_keys : []
  const newNames = matchedNames.filter((n) => !prevNames.includes(n))

  return { matchedNames, newNames, verdict }
}

// 컨설턴트(또는 관리자=전체) 소유 고객 전체를 재판정. hasDetailedData 없는 고객은 건너뜀.
// 재판정 결과를 customers.last_matched_fund_keys / last_rechecked_at 에 저장(다음 비교 기준선 갱신).
export async function recheckAll({ consultantUsername = null, fundsByKey, rulesByKey } = {}) {
  await ensureSchema()
  const customers = consultantUsername
    ? await sql`SELECT * FROM customers WHERE consultant_id = ${consultantUsername}`
    : await sql`SELECT * FROM customers`

  const results = []
  for (const c of customers) {
    const r = recheckOne(c, fundsByKey, rulesByKey)
    if (!r) continue
    if (r.newNames.length > 0) {
      results.push({
        customerId: c.id, ownerName: c.owner_name, businessName: c.business_name,
        consultantId: c.consultant_id, status: c.status, newMatches: r.newNames,
        marketingConsent: !!c.marketing_consent, phone: c.phone,
      })
    }
    // 매칭 목록이 실제로 달라졌을 때만 갱신(불필요한 쓰기 줄임)
    const changed = JSON.stringify(r.matchedNames.slice().sort()) !== JSON.stringify((c.last_matched_fund_keys || []).slice().sort())
    if (changed || !c.last_rechecked_at) {
      await sql`UPDATE customers SET last_matched_fund_keys = ${JSON.stringify(r.matchedNames)}, last_rechecked_at = NOW() WHERE id = ${c.id}`
    }
  }
  return results
}

export async function logNotification({ customerId, channel, message, status, error, sentBy }) {
  await ensureSchema()
  const [row] = await sql`
    INSERT INTO notification_log (customer_id, channel, message, status, error, sent_by)
    VALUES (${customerId}, ${channel}, ${message || null}, ${status}, ${error || null}, ${sentBy || null})
    RETURNING *
  `
  return row
}

export async function listNotifications(customerId) {
  await ensureSchema()
  return sql`SELECT * FROM notification_log WHERE customer_id = ${customerId} ORDER BY created_at DESC`
}
