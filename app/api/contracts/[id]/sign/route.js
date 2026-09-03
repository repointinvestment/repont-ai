// app/api/contracts/[id]/sign/route.js
// 고객이 컨설턴트 화면에서 대면으로 직접 전자서명 — 그 계약을 만든 컨설턴트 본인(또는 관리자)만 진행 가능.

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { signContract } from '@/lib/contractsStore'

export async function POST(request, { params }) {
  const id = Number(params.id)
  const [contract] = await sql`SELECT consultant_username FROM contracts WHERE id = ${id}`
  if (!contract) return NextResponse.json({ error: '계약을 찾을 수 없습니다.' }, { status: 404 })
  const username = request.headers.get('x-consultant-id')
  const role = request.headers.get('x-consultant-role')
  if (role !== 'admin' && String(contract.consultant_username) !== String(username)) {
    return NextResponse.json({ error: '본인이 만든 계약만 서명 처리할 수 있습니다.' }, { status: 403 })
  }
  const body = await request.json().catch(() => ({}))
  if (!body.signatureData || !body.signedName?.trim()) {
    return NextResponse.json({ error: '서명과 이름을 모두 입력해주세요.' }, { status: 400 })
  }
  const c = await signContract(id, body)
  if (!c) return NextResponse.json({ error: '이미 서명되었거나 존재하지 않는 계약입니다.' }, { status: 409 })
  return NextResponse.json({ contract: c })
}
