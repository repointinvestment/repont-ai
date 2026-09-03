// app/api/contracts/reminders/route.js
// 만료 임박(기본 30일 이내) 계약 목록 — 메인메뉴 위젯에서 사용. 컨설턴트는 자기 것만, 관리자는 전체.

import { NextResponse } from 'next/server'
import { listExpiringSoon } from '@/lib/contractsStore'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const withinDays = Number(searchParams.get('within')) || 30
  const username = request.headers.get('x-consultant-id')
  const role = request.headers.get('x-consultant-role')
  const all = await listExpiringSoon({ withinDays })
  const contracts = role === 'admin' ? all : all.filter((c) => c.consultant_username === username)
  return NextResponse.json({ contracts })
}
