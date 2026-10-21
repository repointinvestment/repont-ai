// 내 알림 받을 휴대폰번호(정부지원사업 매칭 알림이 이 번호로 옴) 조회/저장
import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

async function ensure() {
  await sql`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS alert_phone TEXT`
}

export async function GET(request) {
  const u = request.headers.get('x-consultant-id')
  if (!u) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  await ensure()
  const [r] = await sql`SELECT alert_phone FROM accounts WHERE username = ${u}`
  return NextResponse.json({ phone: r?.alert_phone || '' })
}

export async function POST(request) {
  const u = request.headers.get('x-consultant-id')
  if (!u) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  await ensure()
  const { phone } = await request.json().catch(() => ({}))
  const digits = String(phone || '').replace(/[^0-9]/g, '')
  if (digits && !/^01[0-9]{8,9}$/.test(digits)) {
    return NextResponse.json({ error: '휴대폰번호 형식이 올바르지 않아요.' }, { status: 400 })
  }
  await sql`UPDATE accounts SET alert_phone = ${digits || null} WHERE username = ${u}`
  return NextResponse.json({ ok: true })
}
