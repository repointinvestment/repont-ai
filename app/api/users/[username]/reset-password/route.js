// app/api/users/[username]/reset-password/route.js
// 관리자가 컨설턴트(또는 다른 관리자) 계정의 비밀번호를 새 값으로 재설정.
// bcrypt 해시로 저장돼 있어 원래 비밀번호를 복구해서 보여주는 건 불가능 — 새 비밀번호로 덮어쓰는 방식.

import { sql } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request, { params }) {
  const requesterRole = request.headers.get('x-consultant-role')
  if (requesterRole !== 'admin') {
    return NextResponse.json({ error: '관리자만 비밀번호를 변경할 수 있습니다.' }, { status: 403 })
  }
  const body = await request.json().catch(() => ({}))
  const { password } = body
  if (!password || password.length < 4) {
    return NextResponse.json({ error: '비밀번호는 4자 이상이어야 합니다.' }, { status: 400 })
  }

  const existing = await sql`SELECT username FROM accounts WHERE username = ${params.username}`
  if (existing.length === 0) {
    return NextResponse.json({ error: '계정을 찾을 수 없습니다.' }, { status: 404 })
  }

  const passwordHash = bcrypt.hashSync(password, 10)
  await sql`UPDATE accounts SET password_hash = ${passwordHash} WHERE username = ${params.username}`

  return NextResponse.json({ ok: true })
}
