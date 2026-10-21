// app/api/trial/inquiry/route.js
// 체험 계정 사용자의 "연장·강의 문의" 접수. DB에 저장하고, 알림 번호를 등록한 관리자에게 문자로 알림.
import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { sendSMS } from '@/lib/kakaoSend'

async function ensure() {
  await sql`
    CREATE TABLE IF NOT EXISTS trial_inquiries (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL,
      name TEXT,
      phone TEXT NOT NULL,
      message TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS alert_phone TEXT`
}

export async function POST(request) {
  const username = request.headers.get('x-consultant-id')
  if (!username) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  await ensure()
  const { phone, message } = await request.json().catch(() => ({}))
  const digits = String(phone || '').replace(/[^0-9]/g, '')
  if (!/^01[0-9]{8,9}$/.test(digits)) {
    return NextResponse.json({ error: '연락받을 휴대폰번호를 정확히 입력해주세요.' }, { status: 400 })
  }
  const [recent] = await sql`SELECT COUNT(*)::int AS n FROM trial_inquiries WHERE username = ${username} AND created_at > NOW() - INTERVAL '1 hour'`
  if (recent.n >= 3) return NextResponse.json({ error: '이미 문의가 접수되었어요. 곧 연락드릴게요.' }, { status: 429 })

  const [acc] = await sql`SELECT name FROM accounts WHERE username = ${username}`
  const text = String(message || '').slice(0, 500)
  await sql`INSERT INTO trial_inquiries (username, name, phone, message) VALUES (${username}, ${acc?.name || null}, ${digits}, ${text || null})`

  // 알림 번호를 등록한 관리자에게 문자(실패해도 접수는 유지)
  try {
    const admins = await sql`SELECT alert_phone FROM accounts WHERE role = 'admin' AND alert_phone IS NOT NULL`
    for (const a of admins) {
      await sendSMS({ phone: a.alert_phone, message: `[자금비서] 체험 이용자 문의\n${acc?.name || username} ${digits}\n${text || '(내용 없음)'}` })
    }
  } catch (e) {
    console.error('체험 문의 알림 문자 실패:', e.message)
  }
  return NextResponse.json({ ok: true })
}
