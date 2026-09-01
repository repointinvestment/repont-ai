// app/api/users/create/route.js
// 관리자 화면에서 새 계정(컨설턴트)을 만들 때 사용.
// role='student'는 더 이상 관리자 화면에서 선택할 수 없음(수강생=컨설턴트로 통합) —
// 과거에 만들어진 계정과의 호환을 위해 서버 쪽 검증에서는 계속 허용만 해둠.
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
