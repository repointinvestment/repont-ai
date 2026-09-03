// app/api/customers/[id]/document-facts/route.js
// GET  : 이 고객의 서류발급(CODEF) 결과에서 뽑은 사실값 + CRM 값과의 비교 목록
// POST : 컨설턴트가 화면에서 고른 항목만 CRM에 반영 (부분 갱신 — 기존 PATCH는 전체 필드를 요구해서 별도로 둠)
//        body: { fields: { businessAgeYears?, revenueAmount?, industry?, taxDelinquent?('yes'|'no') } }

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getDocumentFacts, compareWithCustomer } from '@/lib/documentFacts'

export async function GET(request, { params }) {
  const id = Number(params.id)
  const [customer] = await sql`SELECT * FROM customers WHERE id = ${id}`
  if (!customer) return NextResponse.json({ error: '고객을 찾을 수 없습니다.' }, { status: 404 })
  try {
    const facts = await getDocumentFacts(id, customer.biz_reg_number)

    // 업력(사업자등록증명의 사업자등록일)과 폐업이력·현재 사업자 개수(사업자등록증명 vs 부가세과세표준증명 대조)는
    // 서류가 CRM 수기입력보다 명백히 더 정확해서 자동 반영 — 특히 currentBizCount는 재도전특별자금의
    // "현재 사업자 1개" 조건 판정에 직접 쓰이는 값이라, 오래된 CRM 값이 남아있으면 자격판정 자체가 틀어짐.
    const updates = {}
    const pfdUpdates = {}
    const docAge = facts.registration?.bizAgeYears
    if (docAge != null && Number(customer.business_age_years ?? -1) !== Number(docAge)) {
      updates.business_age_years = docAge
    }
    // 개업일은 매출초과차입금 계산엔 안 쓰지만(그건 사업자등록일 기준) 별도로 필요한 자금 조건이 있어 CRM의 open_date 칸에도 자동 반영.
    const docOpenDate = facts.registration?.businessStartDate
    if (docOpenDate && customer.open_date !== docOpenDate) {
      updates.open_date = docOpenDate
    }
    if (facts.businessHistory?.reliable) {
      const bh = facts.businessHistory
      const docBankruptcy = bh.hasClosureHistory ? 'yes' : 'no'
      const pfd = customer.policy_fund_details || {}
      if (pfd.hasBankruptcy !== docBankruptcy) pfdUpdates.hasBankruptcy = docBankruptcy
      if (bh.activeCount > 0 && String(pfd.currentBizCount || '') !== String(bh.activeCount)) {
        pfdUpdates.currentBizCount = String(bh.activeCount)
      }
    }

    let updatedCustomer = customer
    if (Object.keys(updates).length > 0 || Object.keys(pfdUpdates).length > 0) {
      const nextPfd = { ...(customer.policy_fund_details || {}), ...pfdUpdates, _docAppliedAt: new Date().toISOString() }
      const [row] = await sql`
        UPDATE customers SET
          business_age_years = COALESCE(${updates.business_age_years ?? null}, business_age_years),
          open_date = COALESCE(${updates.open_date ?? null}, open_date),
          policy_fund_details = ${JSON.stringify(nextPfd)},
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `
      if (row) updatedCustomer = row
    }

    const comparison = compareWithCustomer(facts, updatedCustomer)
    return NextResponse.json({ facts, comparison, customer: updatedCustomer, autoApplied: updatedCustomer !== customer })
  } catch (err) {
    console.error('document-facts 추출 실패:', err)
    return NextResponse.json({ facts: { sources: {} }, comparison: [], error: err.message })
  }
}

export async function POST(request, { params }) {
  const id = Number(params.id)
  const body = await request.json().catch(() => ({}))
  const f = body.fields || {}
  const [customer] = await sql`SELECT policy_fund_details FROM customers WHERE id = ${id}`
  if (!customer) return NextResponse.json({ error: '고객을 찾을 수 없습니다.' }, { status: 404 })

  const pfd = { ...(customer.policy_fund_details || {}) }
  if (f.taxDelinquent === 'yes' || f.taxDelinquent === 'no') pfd.taxDelinquent = f.taxDelinquent
  if (f.hasBankruptcy === 'yes' || f.hasBankruptcy === 'no') pfd.hasBankruptcy = f.hasBankruptcy
  if (f.currentBizCount != null && f.currentBizCount !== '') pfd.currentBizCount = String(f.currentBizCount)
  pfd._docAppliedAt = new Date().toISOString()

  const [row] = await sql`
    UPDATE customers SET
      business_age_years = COALESCE(${f.businessAgeYears ?? null}, business_age_years),
      revenue_amount = COALESCE(${f.revenueAmount ?? null}, revenue_amount),
      industry = COALESCE(${f.industry ?? null}, industry),
      policy_fund_details = ${JSON.stringify(pfd)},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `
  return NextResponse.json({ customer: row })
}
