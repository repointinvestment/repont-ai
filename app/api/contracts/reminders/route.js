// app/api/contracts/reminders/route.js
// 만료 임박(기본 30일 이내) 계약 목록 — 메인메뉴 위젯에서 사용.

import { NextResponse } from 'next/server'
import { listExpiringSoon } from '@/lib/contractsStore'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const withinDays = Number(searchParams.get('within')) || 30
  const contracts = await listExpiringSoon({ withinDays })
  return NextResponse.json({ contracts })
}
