// app/api/auth/route.js
// DB accounts 테이블 기준 로그인. 직원(consultant/admin)과 수강생(student) 계정이 모두 여기서 인증됩니다.
import { sql } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'

export async function POST(req) {
  const { id, pw } = await req.json()

  if (!id || !pw) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const rows = await sql`SELECT * FROM accounts WHERE username = ${id}`
  const account = rows[0]

  if (!account) {
    return NextResponse.json({ ok: false })
  }

  const matches = await bcrypt.compare(pw, account.password_hash)
  if (!matches) {
    return NextResponse.json({ ok: false })
  }

  return NextResponse.json({
    ok: true,
    user: { username: account.username, name: account.name, role: account.role },
  })
}
