// app/api/users/create/route.js
// 관리자 화면에서 새 계정(컨설턴트/수강생)을 만들 때 사용.
import { sql } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const body = await request.json()
  const { username, password, name, role } = body

  if (!username || !password || !name || !role) {
    return NextResponse.json({ error: '아이디, 비밀번호, 이름, 역할을 모두 입력해주세요.' }, { status: 400 })
  }
  if (!['admin', 'consultant', 'student'].includes(role)) {
    return NextResponse.json({ error: '올바르지 않은 역할입니다.' }, { status: 400 })
  }

  const existing = await sql`SELECT id FROM accounts WHERE username = ${username}`
  if (existing.length > 0) {
    return NextResponse.json({ error: '이미 사용 중인 아이디입니다.' }, { status: 409 })
  }

  const passwordHash = bcrypt.hashSync(password, 10)

  const [account] = await sql`
    INSERT INTO accounts (username, password_hash, name, role)
    VALUES (${username}, ${passwordHash}, ${name}, ${role})
    RETURNING username, name, role, created_at
  `

  return NextResponse.json({ account })
}
