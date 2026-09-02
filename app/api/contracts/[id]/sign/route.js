// app/api/contracts/[id]/sign/route.js
// 전자서명 제출. status가 '발송'일 때만 서명 가능(중복 서명 방지).

import { NextResponse } from 'next/server'
import { signContract } from '@/lib/contractsStore'

export async function POST(request, { params }) {
  const body = await request.json().catch(() => ({}))
  if (!body.signatureData || !body.signedName?.trim()) {
    return NextResponse.json({ error: '서명과 이름을 모두 입력해주세요.' }, { status: 400 })
  }
  const c = await signContract(Number(params.id), body)
  if (!c) return NextResponse.json({ error: '이미 서명되었거나 존재하지 않는 계약입니다.' }, { status: 409 })
  return NextResponse.json({ contract: c })
}
