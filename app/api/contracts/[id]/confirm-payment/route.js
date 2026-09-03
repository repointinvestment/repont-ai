// app/api/contracts/[id]/confirm-payment/route.js
// 입금확인 — 그 계약을 만든 컨설턴트 본인(자기 고객한테 받은 돈이니 본인이 확인) 또는 관리자.

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { confirmPayment } from '@/lib/contractsStore'

export async function POST(request, { params }) {
  const id = Number(params.id)
  const [contract] = await sql`SELECT consultant_username FROM contracts WHERE id = ${id}`
  if (!contract) return NextResponse.json({ error: '계약을 찾을 수 없습니다.' }, { status: 404 })
  const username = request.headers.get('x-consultant-id')
  const role = request.headers.get('x-consultant-role')
  if (role !== 'admin' && String(contract.consultant_username) !== String(username)) {
    return NextResponse.json({ error: '본인이 만든 계약만 입금확인할 수 있습니다.' }, { status: 403 })
  }
  const c = await confirmPayment(id, username)
  if (!c) return NextResponse.json({ error: '서명 완료 상태의 계약만 입금확인이 가능합니다.' }, { status: 409 })
  return NextResponse.json({ contract: c })
}
