// app/api/customers/[id]/send-kakao/route.js
// 구DB 재검토 위젯의 "카카오 알림 보내기" 버튼 — 해당 고객 담당 컨설턴트(또는 관리자)만,
// 수신동의(marketing_consent)한 고객에게만 발송. 발송 전/후 결과를 notification_log에 남김.

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { sendAlimtalk, isKakaoSendConfigured } from '@/lib/kakaoSend'
import { logNotification } from '@/lib/customerRecheckStore'

export async function POST(request, { params }) {
  const id = Number(params.id)
  const username = request.headers.get('x-consultant-id')
  const role = request.headers.get('x-consultant-role')
  const [customer] = await sql`SELECT * FROM customers WHERE id = ${id}`
  if (!customer) return NextResponse.json({ error: '고객을 찾을 수 없습니다.' }, { status: 404 })
  if (role !== 'admin' && String(customer.consultant_id) !== String(username)) {
    return NextResponse.json({ error: '본인 고객에게만 발송할 수 있습니다.' }, { status: 403 })
  }
  if (!customer.marketing_consent) {
    return NextResponse.json({ error: '이 고객은 정책자금 안내 수신에 동의하지 않았습니다. 먼저 수신동의를 받아주세요.' }, { status: 400 })
  }
  if (!customer.phone) {
    return NextResponse.json({ error: '연락처가 등록되어 있지 않습니다.' }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  const fundName = body.fundName || '새로운 정책자금'
  const message = `${customer.owner_name}님, ${fundName} 자금 신청이 가능해진 것으로 확인됩니다.`
  const sendingConsultant = customer.consultant_id || username

  if (!(await isKakaoSendConfigured(sendingConsultant))) {
    await logNotification({ customerId: id, channel: 'kakao', message, status: 'failed', error: '발송 미연결(카카오 알림 설정 필요)', sentBy: username })
    return NextResponse.json({ error: '카카오 알림 발송이 아직 연결되지 않았습니다. "카카오 알림 설정" 메뉴에서 솔라피 계정을 연결해주세요.' }, { status: 501 })
  }

  try {
    await sendAlimtalk({ consultantUsername: sendingConsultant, phone: customer.phone, variables: { '#{고객명}': customer.owner_name, '#{자금명}': fundName } })
    const log = await logNotification({ customerId: id, channel: 'kakao', message, status: 'sent', sentBy: username })
    return NextResponse.json({ ok: true, log })
  } catch (err) {
    const log = await logNotification({ customerId: id, channel: 'kakao', message, status: 'failed', error: err.message, sentBy: username })
    return NextResponse.json({ error: err.message, log }, { status: 500 })
  }
}
