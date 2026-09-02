// app/api/applications/reminders/route.js
// 전체 고객 중 재신청 가능 시점이 됐거나 임박한 부결 건 (메인메뉴 위젯 + /reminders 화면에서 사용).
// ?within=14 로 임박 기준 일수 조정 가능 (기본 14일).

import { NextResponse } from 'next/server'
import { listReapplyReminders, listAwaitingAnnouncement } from '@/lib/applicationsStore'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const withinDays = Number(searchParams.get('within')) || 14
  const [dated, announcement] = await Promise.all([
    listReapplyReminders({ withinDays }),
    listAwaitingAnnouncement(),
  ])
  return NextResponse.json({ dated, announcement })
}
