// app/api/users/route.js
// 관리자 화면(계정 목록)에서 사용. DB accounts 테이블 기준. 관리자 전용 — 계정 목록(아이디·이름·역할)
// 자체가 내부 정보라 아무나 조회하면 안 됨.
import { sql } from '@/lib/db'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  if (request.headers.get('x-consultant-role') !== 'admin') {
    return NextResponse.json({ error: '관리자만 조회할 수 있습니다.' }, { status: 403 })
  }
  const users = await sql`SELECT username, name, role, created_at FROM accounts ORDER BY created_at ASC`
  return NextResponse.json({ users })
}
