// app/api/customers/[id]/send-kakao/route.js
// 구DB 재검토 위젯의 "카카오 알림 보내기" 버튼 — 해당 고객 담당 컨설턴트(또는 관리자)만,
// 수신동의(marketing_consent)한 고객에게만 발송. lib/notificationSend.js 공통 로직 사용.

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { sendCustomerAlert } from '@/lib/notificationSend'

export async function POST(request, { params }) {
  const id = Number(params.id)
  const username = request.headers.get('x-consultant-id')
  const role = request.headers.get('x-consultant-role')
  const [customer] = await sql`SELECT * FROM customers WHERE id = ${id}`
  if (!customer) return NextResponse.json({ error: '고객을 찾을 수 없습니다.' }, { status: 404 })
  if (role !== 'admin' && String(customer.consultant_id) !== String(username)) {
    return NextResponse.json({ error: '본인 고객에게만 발송할 수 있습니다.' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const fundName = body.fundName || '새로운 정책자금'
  const siteOrigin = new URL(request.url).origin

  const result = await sendCustomerAlert({ customer, fundName, siteOrigin, sentBy: username })
  if (!result.ok) return NextResponse.json({ error: result.error, log: result.log }, { status: result.status })
  return NextResponse.json({ ok: true, log: result.log })
}
