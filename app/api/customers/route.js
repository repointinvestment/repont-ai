// app/api/customers/route.js
// 담당 컨설턴트 본인 고객만 조회. role='admin'이면 전체 조회.

import { sql } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request) {
  // TODO: 실제로는 세션/쿠키에서 로그인한 consultant를 가져와야 함.
  // 지금은 자리표시자로 헤더에서 받는 걸로 표시해둠 — 로그인 붙일 때 교체.
  const consultantId = request.headers.get('x-consultant-id')
  const role = request.headers.get('x-consultant-role')

const rows = (role === 'admin' || !consultantId)
  ? await sql`SELECT * FROM customers ORDER BY updated_at DESC`
  : await sql`SELECT * FROM customers WHERE consultant_id = ${consultantId} ORDER BY updated_at DESC`

  return NextResponse.json({ customers: rows })
}

export async function POST(request) {
  const consultantId = request.headers.get('x-consultant-id')
  const body = await request.json()

  const [customer] = await sql`
    INSERT INTO customers (
      consultant_id, business_name, business_type, owner_name, phone, email,
      biz_reg_number, establish_date, open_date, address, industry,
      business_content, employee_count, last_year_sales, credit_nice, credit_kcb
    ) VALUES (
      ${consultantId}, ${body.businessName}, ${body.businessType}, ${body.ownerName}, ${body.phone}, ${body.email},
      ${body.bizRegNumber}, ${body.establishDate}, ${body.openDate}, ${body.address}, ${body.industry},
      ${body.businessContent}, ${body.employeeCount || 0}, ${body.lastYearSales}, ${body.creditNice}, ${body.creditKcb}
    )
    RETURNING *
  `
  return NextResponse.json({ customer })
}
