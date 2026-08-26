// app/api/customers/[id]/route.js
import { sql } from '@/lib/db'
import { NextResponse } from 'next/server'

// 고객 1명 상세 조회
export async function GET(request, { params }) {
  const { id } = params
  const rows = await sql`SELECT * FROM customers WHERE id = ${id}`
  if (rows.length === 0) {
    return NextResponse.json({ error: '고객을 찾을 수 없습니다.' }, { status: 404 })
  }
  return NextResponse.json({ customer: rows[0] })
}

// 고객 정보 수정
export async function PATCH(request, { params }) {
  const { id } = params
  const body = await request.json()

  const [customer] = await sql`
    UPDATE customers SET
      business_name = ${body.businessName},
      business_type = ${body.businessType},
      owner_name = ${body.ownerName},
      phone = ${body.phone},
      email = ${body.email},
      biz_reg_number = ${body.bizRegNumber},
      establish_date = ${body.establishDate},
      open_date = ${body.openDate},
      address = ${body.address},
      industry = ${body.industry},
      business_content = ${body.businessContent},
      employee_count = ${body.employeeCount || 0},
      last_year_sales = ${body.lastYearSales},
      credit_nice = ${body.creditNice},
      credit_kcb = ${body.creditKcb},
      revenue_amount = ${body.revenueAmount},
      address_ownership = ${body.addressOwnership},
      residence_address = ${body.residenceAddress},
      residence_ownership = ${body.residenceOwnership},
      loan_status = ${body.loanStatus},
      memo = ${body.memo},
      status = ${body.status},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `

  if (!customer) {
    return NextResponse.json({ error: '고객을 찾을 수 없습니다.' }, { status: 404 })
  }

  return NextResponse.json({ customer })
}

// 고객 삭제
export async function DELETE(request, { params }) {
  const { id } = params
  await sql`DELETE FROM customer_credentials WHERE customer_id = ${id}`
  await sql`DELETE FROM customers WHERE id = ${id}`
  return NextResponse.json({ success: true })
}
