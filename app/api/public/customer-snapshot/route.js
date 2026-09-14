// app/api/public/customer-snapshot/route.js
// 재방문 고객(머니콕 카톡 "문의하기")이 이름·업력·매출을 다시 입력하지 않아도 되도록, 토큰으로
// 저장된 정보를 돌려줌. 개인정보 유출 방지를 위해 로그인 없이도 "이 토큰을 아는 사람만" 볼 수 있는
// 최소 정보만 내려줌 — 주민등록번호 등 민감정보는 애초에 이 테이블 select에 없음.

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('t')
  if (!token) return NextResponse.json({ error: '토큰이 필요합니다.' }, { status: 400 })

  const [customer] = await sql`
    SELECT id, owner_name, business_name, industry, business_age_years, revenue_amount,
           employee_count, credit_nice, credit_kcb, has_patent, owner_career_years, policy_fund_details
    FROM customers WHERE public_token = ${token}
  `
  if (!customer) return NextResponse.json({ error: '유효하지 않은 링크입니다.' }, { status: 404 })
  return NextResponse.json({ customer })
}
