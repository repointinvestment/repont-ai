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
    // 업력은 서류(사업자등록증명 개업일)가 더 정확 → 서류가 있으면 CRM 업력을 자동으로 맞춤. 서류 없으면 등록 때 입력한 업력 그대로.
    let updatedCustomer = customer
    const docAge = facts.registration?.bizAgeYears
    if (docAge != null && Number(customer.business_age_years ?? -1) !== Number(docAge)) {
      const [row] = await sql`UPDATE customers SET business_age_years = ${docAge}, updated_at = NOW() WHERE id = ${id} RETURNING *`
      if (row) updatedCustomer = row
    }
    const comparison = compareWithCustomer(facts, updatedCustomer)
    return NextResponse.json({ facts, comparison, customer: updatedCustomer, bizAgeAutoApplied: updatedCustomer !== customer })
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
