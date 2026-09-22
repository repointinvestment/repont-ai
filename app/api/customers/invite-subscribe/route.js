// app/api/customers/invite-subscribe/route.js
// 컨설턴트가 자기 고객 중 골라서(또는 전체) "신청 안내 문자"를 한 번에 발송. 본인 고객만 대상.

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { sendSMS } from '@/lib/kakaoSend'
import { getOrCreatePublicToken, logNotification } from '@/lib/customerRecheckStore'

export async function POST(request) {
  const username = request.headers.get('x-consultant-id')
  if (!username) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const customerIds = Array.isArray(body.customerIds) ? body.customerIds.map(Number) : []
  if (customerIds.length === 0) return NextResponse.json({ error: '고객을 선택해주세요.' }, { status: 400 })

  // 본인 담당 고객만 걸러서 대상으로 삼음(다른 컨설턴트 고객 섞여 들어와도 무시).
  const customers = await sql`
    SELECT id, owner_name, phone FROM customers
    WHERE id = ANY(${customerIds}) AND consultant_id = ${username} AND phone IS NOT NULL
  `

  const siteOrigin = new URL(request.url).origin
  let sent = 0
  const failed = []
  for (const c of customers) {
    try {
      const token = await getOrCreatePublicToken(c.id)
      const link = `${siteOrigin}/join/${token}`
      const message = `[머니콕] ${c.owner_name}님, 정책자금·지원금 새 소식을 카톡으로 받아보시겠어요? 신청: ${link}`
      await sendSMS({ phone: c.phone, message })
      await logNotification({ customerId: c.id, channel: 'sms', message, status: 'sent', sentBy: username })
      sent++
    } catch (err) {
      await logNotification({ customerId: c.id, channel: 'sms', message: '신청안내 문자', status: 'failed', error: err.message, sentBy: username })
      failed.push({ id: c.id, name: c.owner_name, error: err.message })
    }
  }

  return NextResponse.json({ ok: true, sent, failed })
}
