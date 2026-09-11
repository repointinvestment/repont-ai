// app/api/consultant/messaging-config/request/route.js
// 컨설턴트가 기술 값 없이 기본정보만 내는 "연동 신청" — 실제 설정은 관리자가 대신 처리.

import { NextResponse } from 'next/server'
import { submitRequest } from '@/lib/consultantMessagingStore'

export async function POST(request) {
  const username = request.headers.get('x-consultant-id')
  if (!username) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  if (!body.businessName?.trim() || !body.phone?.trim()) {
    return NextResponse.json({ error: '상호명과 연락처는 필수입니다.' }, { status: 400 })
  }
  const row = await submitRequest(username, body)
  return NextResponse.json({ ok: true, config: row })
}
