// app/api/consultant/notifications/route.js
// 컨설턴트 본인 고객한테 나간 발송 내역만 — "내 발송 내역" 화면.

import { NextResponse } from 'next/server'
import { listNotificationsForConsultant } from '@/lib/customerRecheckStore'

export async function GET(request) {
  const username = request.headers.get('x-consultant-id')
  if (!username) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  const notifications = await listNotificationsForConsultant(username)
  return NextResponse.json({ notifications })
}
