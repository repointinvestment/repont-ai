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
  const siteOrigin = new URL(request.url).origin
  const sendingConsultant = customer.consultant_id || username
  const inquiryLink = `${siteOrigin}/apply/${sendingConsultant}`
  const [consultantAccount] = await sql`SELECT name FROM accounts WHERE username = ${sendingConsultant}`
  const consultantName = consultantAccount?.name || '담당자'
  // 발신자 표시(카톡 채널명)는 그 컨설턴트가 만든 채널 이름 그대로 뜨므로, 본문도 "머니콕" 대신
  // 담당자 이름으로 시작 — 고객이 "누구지?"가 아니라 "아 그 사람" 하고 바로 알아보게.
  const message = `${consultantName} 담당자입니다. ${customer.owner_name}님, ${fundName} 자금 신청이 가능해진 것으로 확인됩니다. 문의: ${inquiryLink}`

  if (!(await isKakaoSendConfigured(sendingConsultant))) {
    await logNotification({ customerId: id, channel: 'kakao', message, status: 'failed', error: '발송 미연결(카카오 알림 설정 필요)', sentBy: username })
    return NextResponse.json({ error: '카카오 알림 발송이 아직 연결되지 않았습니다. "카카오 알림 설정" 메뉴에서 솔라피 계정을 연결해주세요.' }, { status: 501 })
  }

  try {
    // 템플릿 변수명은 실제 솔라피에 승인된 알림톡 템플릿의 변수명과 정확히 일치해야 함(심사 시 확정).
    // #{문의링크}는 그 고객 담당 컨설턴트의 /apply/[아이디] 자가진단 공개 링크 — 고객이 "문의하기"를
    // 누르면 그 컨설턴트의 자금비서 CRM에 리드로 자동 등록됨(이미 구현된 흐름 재사용).
    await sendAlimtalk({
      consultantUsername: sendingConsultant, phone: customer.phone,
      variables: { '#{담당자명}': consultantName, '#{고객명}': customer.owner_name, '#{자금명}': fundName, '#{문의링크}': inquiryLink },
    })
    const log = await logNotification({ customerId: id, channel: 'kakao', message, status: 'sent', sentBy: username })
    return NextResponse.json({ ok: true, log })
  } catch (err) {
    const log = await logNotification({ customerId: id, channel: 'kakao', message, status: 'failed', error: err.message, sentBy: username })
    return NextResponse.json({ error: err.message, log }, { status: 500 })
  }
}
