// app/api/customers/[id]/credentials/route.js
// 고객 상세 화면에서 "계정정보 복사" 버튼 목록을 그리기 위한 목록 조회.
// 값(비밀번호)은 여기서 절대 내려주지 않고, id/종류만 반환. 실제 복호화된 값은
// POST /api/credentials/[id]/copy 를 눌렀을 때만 조회합니다.
import { sql } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request, { params }) {
  const { id } = params
  const rows = await sql`
    SELECT id, service_name
    FROM customer_credentials
    WHERE customer_id = ${id}
    ORDER BY id ASC
  `
  return NextResponse.json({ credentials: rows })
}
