// app/api/contracts/[id]/confirm-payment/route.js
// 입금확인 처리(관리자 전용) — 계약 시작일/만료일을 오늘 기준으로 설정하고 상태를 '입금확인'(=활성)으로.

import { NextResponse } from 'next/server'
import { confirmPayment } from '@/lib/contractsStore'

export async function POST(request, { params }) {
  if (request.headers.get('x-consultant-role') !== 'admin') {
    return NextResponse.json({ error: '관리자만 입금확인을 처리할 수 있습니다.' }, { status: 403 })
  }
  const c = await confirmPayment(Number(params.id), request.headers.get('x-consultant-id') || 'admin')
  if (!c) return NextResponse.json({ error: '서명 완료 상태의 계약만 입금확인이 가능합니다.' }, { status: 409 })
  return NextResponse.json({ contract: c })
}
