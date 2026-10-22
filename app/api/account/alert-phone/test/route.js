// 내 알림 번호로 테스트 문자 1건 발송 — 솔라피 설정(API키·시크릿·발신번호)이 실제로 되는지 바로 확인용.
// 실패 사유를 그대로 돌려줘서 어디가 문제인지(설정 누락 / 발신번호 미등록 / 잔액 부족 등) 바로 알 수 있게.
import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { sendSMS } from '@/lib/kakaoSend'

export async function POST(request) {
  const u = request.headers.get('x-consultant-id')
  const role = request.headers.get('x-consultant-role')
  if (!u) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  if (role === 'trial') return NextResponse.json({ error: '체험 계정은 사용할 수 없어요.' }, { status: 403 })
  await sql`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS alert_phone TEXT`
  const [r] = await sql`SELECT alert_phone, name FROM accounts WHERE username = ${u}`
  if (!r?.alert_phone) return NextResponse.json({ error: '먼저 알림 번호를 저장하세요.' }, { status: 400 })
  try {
    await sendSMS({ phone: r.alert_phone, message: `[자금비서] 알림 번호 테스트\n${r.name || u}님, 이 번호로 알림이 정상 발송됩니다.` })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: `발송 실패: ${e.message}` }, { status: 500 })
  }
}
