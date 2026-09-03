// app/api/contracts/route.js
// 전체 계약 현황 조회 — 관리자는 전체, 컨설턴트는 자기가 만든 것만. 생성은 여기서 안 함
// (계약은 항상 특정 고객에 딸린 것이라 /api/customers/[id]/contracts에서 생성).

import { NextResponse } from 'next/server'
import { listContracts } from '@/lib/contractsStore'

export async function GET(request) {
  const username = request.headers.get('x-consultant-id')
  const role = request.headers.get('x-consultant-role')
  const contracts = await listContracts({ consultantUsername: role === 'admin' ? null : username })
  return NextResponse.json({ contracts })
}
