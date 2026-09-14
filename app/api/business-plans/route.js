// app/api/business-plans/route.js
import { sql } from '@/lib/db'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const consultantId = request.headers.get('x-consultant-id')
  const role = request.headers.get('x-consultant-role')

  // consultantId가 없으면(헤더를 안 보냈으면) 무조건 거부 — 예전엔 이 경우를 "전체 조회 허용"으로 잘못
  // 처리해서, 로그인 헤더를 안 보내기만 하면 아무나 전체 사업계획서 내용을 볼 수 있는 구멍이 있었음.
  if (!consultantId) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const rows = role === 'admin'
    ? await sql`
        SELECT bp.id, bp.customer_id, bp.fund_name, bp.content, bp.created_at,
               c.owner_name, c.business_name
        FROM business_plans bp
        JOIN customers c ON c.id = bp.customer_id
        ORDER BY bp.created_at DESC
      `
    : await sql`
        SELECT bp.id, bp.customer_id, bp.fund_name, bp.content, bp.created_at,
               c.owner_name, c.business_name
        FROM business_plans bp
        JOIN customers c ON c.id = bp.customer_id
        WHERE c.consultant_id = ${consultantId}
        ORDER BY bp.created_at DESC
      `

  return NextResponse.json({ plans: rows })
}
