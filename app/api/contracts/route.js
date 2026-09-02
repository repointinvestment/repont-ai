// app/api/contracts/route.js
// 계약 목록 조회(관리자=전체, 본인=자기 것만) / 신규 계약 생성(관리자 전용).

import { NextResponse } from 'next/server'
import { listContracts, createContract } from '@/lib/contractsStore'

export async function GET(request) {
  const role = request.headers.get('x-consultant-role')
  const username = request.headers.get('x-consultant-id')
  const contracts = await listContracts({ username: role === 'admin' ? null : username })
  return NextResponse.json({ contracts })
}

export async function POST(request) {
  if (request.headers.get('x-consultant-role') !== 'admin') {
    return NextResponse.json({ error: '관리자만 계약을 생성할 수 있습니다.' }, { status: 403 })
  }
  const body = await request.json().catch(() => ({}))
  if (!body.consultantUsername) return NextResponse.json({ error: '대상 계정을 선택해주세요.' }, { status: 400 })
  const c = await createContract(body, request.headers.get('x-consultant-id') || 'admin')
  return NextResponse.json({ contract: c })
}
