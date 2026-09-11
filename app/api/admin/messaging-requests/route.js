// app/api/admin/messaging-requests/route.js
// 관리자 전용 — 컨설턴트들의 카카오 알림 연동 신청 목록 조회, 그리고 처리 완료 후 실제 키를 대신 입력.

import { NextResponse } from 'next/server'
import { listRequests, upsertConfig, setRequestStatus } from '@/lib/consultantMessagingStore'

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

  if (body.status && !body.apiKey) {
    // 상태만 바꾸는 경우 (예: '처리중'으로 표시)
    await setRequestStatus(body.consultantUsername, body.status)
    return NextResponse.json({ ok: true })
  }

  const row = await upsertConfig(body.consultantUsername, body)
  return NextResponse.json({ ok: true, config: row })
}
