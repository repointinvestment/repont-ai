// app/api/customers/[id]/credentials/route.js
// 고객 상세 화면에서 "계정정보 복사" 버튼 목록을 그리기 위한 목록 조회.
// 값(비밀번호)은 여기서 절대 내려주지 않고, id/종류만 반환. 실제 복호화된 값은
// POST /api/credentials/[id]/copy 를 눌렀을 때만 조회합니다.
import { sql } from '@/lib/db'
import { upsertNamedCredential } from '@/lib/credentials'
import { NextResponse } from 'next/server'

export async function GET(request, { params }) {
  const { id } = params
  const rows = await sql`
    SELECT id, service_name, username, (secondary_password_encrypted IS NOT NULL) AS has_secondary
    FROM customer_credentials
    WHERE customer_id = ${id}
    ORDER BY id ASC
  `
  return NextResponse.json({ credentials: rows })
}

// 고객 등록/수정 화면의 "추가 계정 정보 > 확인" 버튼에서 즉시 저장할 때 사용.
export async function POST(request, { params }) {
  const { id } = params
  const body = await request.json()

  if (!body.serviceName) {
    return NextResponse.json({ error: '서비스명이 필요합니다.' }, { status: 400 })
  }

  try {
    const saved = await upsertNamedCredential(id, body.serviceName, body.username, body.password, body.secondaryPassword)
    return NextResponse.json({ credential: saved })
  } catch (err) {
    console.error('계정 정보 저장 실패:', err)
    return NextResponse.json({ error: '저장 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
