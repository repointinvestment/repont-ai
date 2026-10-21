// app/api/auth/route.js
// DB accounts 테이블 기준 로그인 + 서명된 세션 쿠키 발급.
// 직원(consultant/admin)·수강생(student)·웨비나 체험(trial) 계정이 모두 여기서 인증됩니다.
import { sql } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'
import { signSession, SESSION_COOKIE, SESSION_MAX_SECONDS } from '@/lib/sessionToken'
import { ensureAccountsSchema } from '@/lib/accountsStore'

export const dynamic = 'force-dynamic'

function clientIp(req) {
  return (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
}

function cookieOptions(maxAgeSeconds) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSeconds,
  }
}

export async function POST(req) {
  const { id, pw } = await req.json()

  if (!id || !pw) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  await ensureAccountsSchema()
  const ip = clientIp(req)

  // 무차별 대입 방어: 같은 아이디로 10분 내 10회, 같은 IP로 10분 내 40회 실패하면 잠시 차단
  const [byUser] = await sql`SELECT COUNT(*)::int AS n FROM login_attempts WHERE username = ${id} AND success = FALSE AND created_at > NOW() - INTERVAL '10 minutes'`
  const [byIp] = await sql`SELECT COUNT(*)::int AS n FROM login_attempts WHERE ip = ${ip} AND success = FALSE AND created_at > NOW() - INTERVAL '10 minutes'`
  if (byUser.n >= 10 || byIp.n >= 40) {
    return NextResponse.json({ ok: false, error: 'too_many_attempts' }, { status: 429 })
  }

  const rows = await sql`SELECT * FROM accounts WHERE username = ${id}`
  const account = rows[0]

  const matches = account ? await bcrypt.compare(pw, account.password_hash) : false
  if (!account || !matches) {
    await sql`INSERT INTO login_attempts (ip, username, success) VALUES (${ip}, ${id}, FALSE)`
    return NextResponse.json({ ok: false })
  }

  // 체험 계정 등 만료일이 있는 계정은 만료 후 로그인 불가
  const expiresAtMs = account.expires_at ? new Date(account.expires_at).getTime() : null
  if (expiresAtMs && expiresAtMs < Date.now()) {
    return NextResponse.json({ ok: false, error: 'expired' })
  }

  await sql`INSERT INTO login_attempts (ip, username, success) VALUES (${ip}, ${id}, TRUE)`

  // 세션 만료 = 30일 후, 단 계정 만료일이 더 빠르면 그 시각
  const defaultExp = Date.now() + SESSION_MAX_SECONDS * 1000
  const sessionExp = expiresAtMs ? Math.min(defaultExp, expiresAtMs) : defaultExp
  const token = await signSession({ u: account.username, r: account.role }, sessionExp)

  const res = NextResponse.json({
    ok: true,
    user: { username: account.username, name: account.name, role: account.role, expiresAt: account.expires_at || null },
  })
  res.cookies.set(SESSION_COOKIE, token, cookieOptions(Math.max(1, Math.floor((sessionExp - Date.now()) / 1000))))
  return res
}

// 로그아웃: 세션 쿠키 삭제
export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, '', cookieOptions(0))
  return res
}
