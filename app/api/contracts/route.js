// app/api/contracts/route.js
// 전체 계약 현황 조회 — 관리자는 전체, 컨설턴트는 자기가 만든 것만. 생성은 여기서 안 함
// (계약은 항상 특정 고객에 딸린 것이라 /api/customers/[id]/contracts에서 생성).

import { NextResponse } from 'next/server'
import { listContracts } from '@/lib/contractsStore'

export async function GET(request) {
  const username = request.headers.get('x-consultant-id')
  const role = request.headers.get('x-consultant-role')
  // 헤더 없으면(로그인 안 한 상태) 무조건 거부 — 헤더가 빈 문자열이면 falsy라 store 쪽에서
  // "전체 조회"로 빠지는 구조라, 여기서 미리 막아야 함(오늘 발견한 같은 패턴의 버그).
  if (!username) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  const contracts = await listContracts({ consultantUsername: role === 'admin' ? null : username })
  return NextResponse.json({ contracts })
}
