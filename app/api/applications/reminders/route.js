// app/api/applications/reminders/route.js
// 전체 고객 중 재신청 가능 시점이 됐거나 임박한 부결 건 (메인메뉴 위젯 + /reminders 화면에서 사용).
// ?within=14 로 임박 기준 일수 조정 가능 (기본 14일). 컨설턴트는 자기 고객 것만, 관리자는 전체.

import { NextResponse } from 'next/server'
import { listReapplyReminders, listAwaitingAnnouncement } from '@/lib/applicationsStore'

export async function GET(request) {
  const username = request.headers.get('x-consultant-id')
  const role = request.headers.get('x-consultant-role')
  if (!username) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const withinDays = Number(searchParams.get('within')) || 14
  const scopeUsername = role === 'admin' ? null : username
  const [dated, announcement] = await Promise.all([
    listReapplyReminders({ withinDays, consultantUsername: scopeUsername }),
    listAwaitingAnnouncement(scopeUsername),
  ])
  return NextResponse.json({ dated, announcement })
}
