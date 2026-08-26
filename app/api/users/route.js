// app/api/users/route.js
// 관리자 화면(계정 목록)에서 사용. DB accounts 테이블 기준.
import { sql } from '@/lib/db'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const users = await sql`SELECT username, name, role, created_at FROM accounts ORDER BY created_at ASC`
  return NextResponse.json({ users })
}
