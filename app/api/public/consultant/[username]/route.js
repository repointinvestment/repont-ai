// app/api/public/consultant/[username]/route.js
// 자가진단 공개 링크(/apply/[username])가 유효한 컨설턴트인지 확인 (로그인 불필요).
// 비밀번호 해시 등 민감정보는 절대 내려주지 않음 — 이름/존재 여부만.

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET(request, { params }) {
  const [row] = await sql`SELECT name, role FROM accounts WHERE username = ${params.username}`
  if (!row || (row.role !== 'consultant' && row.role !== 'admin' && row.role !== 'student')) {
    return NextResponse.json({ valid: false })
  }
  return NextResponse.json({ valid: true, name: row.name })
}
