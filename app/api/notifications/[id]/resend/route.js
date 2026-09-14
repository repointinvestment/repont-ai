// app/api/notifications/[id]/resend/route.js
// 재발송 — 예전에 보낸 로그의 변수를 그대로 재사용해서 다시 보냄. 본인 고객 건만.

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getNotificationLogEntry } from '@/lib/customerRecheckStore'
import { sendCustomerAlert } from '@/lib/notificationSend'

export async function POST(request, { params }) {
  const username = request.headers.get('x-consultant-id')
  const role = request.headers.get('x-consultant-role')
  if (!username) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const entry = await getNotificationLogEntry(Number(params.id))
  if (!entry) return NextResponse.json({ error: '발송 기록을 찾을 수 없습니다.' }, { status: 404 })

  const [customer] = await sql`SELECT * FROM customers WHERE id = ${entry.customer_id}`
  if (!customer) return NextResponse.json({ error: '고객을 찾을 수 없습니다.' }, { status: 404 })
  if (role !== 'admin' && String(customer.consultant_id) !== String(username)) {
    return NextResponse.json({ error: '본인 고객 건만 재발송할 수 있습니다.' }, { status: 403 })
  }

  const siteOrigin = new URL(request.url).origin
  const result = await sendCustomerAlert({
    customer, fundName: entry.fund_name || '정책자금 안내', variables: entry.variables || null, siteOrigin, sentBy: username,
  })
  if (!result.ok) return NextResponse.json({ error: result.error, log: result.log }, { status: result.status })
  return NextResponse.json({ ok: true, log: result.log })
}
