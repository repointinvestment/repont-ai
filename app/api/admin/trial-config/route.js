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
  const accounts = await sql`
    SELECT a.username, a.name, a.created_at, a.expires_at,
           (SELECT COUNT(*)::int FROM customers c WHERE c.consultant_id = a.username) AS customers,
           (SELECT COALESCE(SUM(u.count), 0)::int FROM ai_usage u WHERE u.username = a.username) AS ai_uses
    FROM accounts a WHERE a.role = 'trial' ORDER BY a.created_at DESC LIMIT 500
  `
  await sql`CREATE TABLE IF NOT EXISTS trial_inquiries (id SERIAL PRIMARY KEY, username TEXT NOT NULL, name TEXT, phone TEXT NOT NULL, message TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`
  await sql`ALTER TABLE trial_inquiries ADD COLUMN IF NOT EXISTS sms_status TEXT`
  const inquiries = await sql`SELECT id, username, name, phone, message, sms_status, created_at FROM trial_inquiries ORDER BY created_at DESC LIMIT 100`
  return NextResponse.json({ config: cfg || null, stats, accounts, inquiries })
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

  if (body.action === 'extend' && body.username) {
    const days = Math.max(1, Math.min(60, Number(body.days) || 7))
    await sql`UPDATE accounts SET expires_at = GREATEST(expires_at, NOW()) + (${days}::text || ' days')::interval WHERE username = ${body.username} AND role = 'trial'`
    return NextResponse.json({ ok: true })
  }
  if (body.action === 'delete' && body.username) {
    await sql`DELETE FROM customers WHERE consultant_id = ${body.username}`
    await sql`DELETE FROM accounts WHERE username = ${body.username} AND role = 'trial'`
    return NextResponse.json({ ok: true })
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
