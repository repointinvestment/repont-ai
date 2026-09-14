// app/api/admin/channel-requests/route.js
// 관리자 전용 — 컨설턴트들의 카카오 채널 연동 신청 큐. 처리 완료 후 pfId만 입력하면 연동 켜짐.

import { NextResponse } from 'next/server'
import { listRequests, setSenderKey, setRequestStatus } from '@/lib/consultantChannelStore'

function requireAdmin(request) {
  return request.headers.get('x-consultant-role') === 'admin'
}

export async function GET(request) {
  if (!requireAdmin(request)) return NextResponse.json({ error: '관리자만 조회할 수 있습니다.' }, { status: 403 })
  const requests = await listRequests()
  return NextResponse.json({ requests })
}

export async function PUT(request) {
  if (!requireAdmin(request)) return NextResponse.json({ error: '관리자만 처리할 수 있습니다.' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  if (!body.consultantUsername) return NextResponse.json({ error: 'consultantUsername이 필요합니다.' }, { status: 400 })

  if (body.status && !body.senderKey) {
    await setRequestStatus(body.consultantUsername, body.status)
    return NextResponse.json({ ok: true })
  }
  const row = await setSenderKey(body.consultantUsername, body.senderKey)
  return NextResponse.json({ ok: true, channel: row })
}
