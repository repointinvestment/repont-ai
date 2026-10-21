// app/api/admin/trial-config/route.js
// 웨비나 체험 이용권 설정(관리자 전용): 입장코드, 최대 가입 수, 이용 기간, 신청 열기/닫기. + 현황 조회/만료 계정 정리.
import { sql } from '@/lib/db'
import { NextResponse } from 'next/server'
import { ensureAccountsSchema } from '@/lib/accountsStore'

export const dynamic = 'force-dynamic'

function adminOnly(request) {
  if (request.headers.get('x-consultant-role') !== 'admin') {
    return NextResponse.json({ error: '관리자만 사용할 수 있습니다.' }, { status: 403 })
  }
  return null
}

export async function GET(request) {
  const denied = adminOnly(request)
  if (denied) return denied
  await ensureAccountsSchema()
  const [cfg] = await sql`SELECT * FROM trial_config WHERE id = 1`
  const [stats] = await sql`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE expires_at > NOW())::int AS active
    FROM accounts WHERE role = 'trial'
  `
  return NextResponse.json({ config: cfg || null, stats })
}

export async function POST(request) {
  const denied = adminOnly(request)
  if (denied) return denied
  await ensureAccountsSchema()
  const body = await request.json()

  if (body.action === 'cleanup') {
    // 만료된 체험 계정과 그 계정의 고객 데이터를 삭제(고객 하위 데이터는 FK cascade)
    const expired = await sql`SELECT username FROM accounts WHERE role = 'trial' AND expires_at < NOW() - INTERVAL '1 day'`
    for (const { username } of expired) {
      await sql`DELETE FROM customers WHERE consultant_id = ${username}`
      await sql`DELETE FROM accounts WHERE username = ${username} AND role = 'trial'`
    }
    return NextResponse.json({ ok: true, deleted: expired.length })
  }

  const code = String(body.code || '').trim()
  if (!code || code.length < 4) {
    return NextResponse.json({ error: '입장코드는 4자 이상으로 정해주세요.' }, { status: 400 })
  }
  const maxSignups = Math.max(1, Math.min(2000, Number(body.maxSignups) || 300))
  const days = Math.max(1, Math.min(60, Number(body.days) || 7))
  const active = !!body.active
  await sql`
    INSERT INTO trial_config (id, code, max_signups, days, active, updated_at)
    VALUES (1, ${code}, ${maxSignups}, ${days}, ${active}, NOW())
    ON CONFLICT (id) DO UPDATE SET code = ${code}, max_signups = ${maxSignups}, days = ${days}, active = ${active}, updated_at = NOW()
  `
  return NextResponse.json({ ok: true })
}
