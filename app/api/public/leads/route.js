// app/api/public/leads/route.js
// 자가진단 공개 링크에서 잠재고객이 제출하면 해당 컨설턴트 CRM에 리드로 자동 등록 (로그인 불필요).
// 노출 필드를 의도적으로 제한 — 공개 폼이라 민감 정보(주민번호, 인증서 등)는 애초에 받지 않음.

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function POST(request) {
  const body = await request.json().catch(() => ({}))
  const { consultantUsername, ownerName, phone, industry, businessAgeYears, revenueAmount, employeeCount } = body

  if (!consultantUsername || !ownerName || !phone) {
    return NextResponse.json({ error: '필수 항목이 누락되었습니다.' }, { status: 400 })
  }
  const [consultant] = await sql`SELECT username FROM accounts WHERE username = ${consultantUsername}`
  if (!consultant) return NextResponse.json({ error: '유효하지 않은 링크입니다.' }, { status: 404 })

  const [customer] = await sql`
    INSERT INTO customers (
      consultant_id, owner_name, phone, industry, business_age_years, revenue_amount, employee_count,
      memo, status
    ) VALUES (
      ${consultantUsername}, ${ownerName}, ${phone}, ${industry || null}, ${businessAgeYears || null},
      ${revenueAmount || null}, ${employeeCount || 0}, ${'자가진단 공개 링크로 유입'}, ${'상담중'}
    )
    RETURNING id
  `
  await sql`INSERT INTO customer_status_history (customer_id, status) VALUES (${customer.id}, '상담중')`
  return NextResponse.json({ ok: true, customerId: customer.id })
}
