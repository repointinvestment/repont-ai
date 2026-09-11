// app/api/consultant/messaging-config/route.js
// 컨설턴트 본인의 카카오 알림(솔라피) 연결 정보 — 본인 것만 조회·저장 가능(다른 컨설턴트 키는 못 봄).

import { NextResponse } from 'next/server'
import { getConfigForDisplay, upsertConfig } from '@/lib/consultantMessagingStore'

export async function GET(request) {
  const username = request.headers.get('x-consultant-id')
  if (!username) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  const config = await getConfigForDisplay(username)
  return NextResponse.json({ config })
}

export async function PUT(request) {
  const username = request.headers.get('x-consultant-id')
  if (!username) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const row = await upsertConfig(username, body)
  return NextResponse.json({ ok: true, updatedAt: row.updated_at })
}
