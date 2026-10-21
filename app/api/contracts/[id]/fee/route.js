// app/api/contracts/[id]/fee/route.js
// 성공보수(후불 수수료) 정산 추적 — CMS 동의 수령/자금 실행/수수료 입금 기록. 계약 만든 본인 또는 관리자.
// 계좌번호 등 금융정보는 저장하지 않는다(CMS 업체 시스템에만 보관).
import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { updateFeeTracking } from '@/lib/contractsStore'

export async function POST(request, { params }) {
  const id = Number(params.id)
  const [contract] = await sql`SELECT consultant_username FROM contracts WHERE id = ${id}`
  if (!contract) return NextResponse.json({ error: '계약을 찾을 수 없습니다.' }, { status: 404 })
  const username = request.headers.get('x-consultant-id')
  const role = request.headers.get('x-consultant-role')
  if (role !== 'admin' && String(contract.consultant_username) !== String(username)) {
    return NextResponse.json({ error: '본인이 만든 계약만 수정할 수 있습니다.' }, { status: 403 })
  }
  const b = await request.json().catch(() => ({}))
  const c = await updateFeeTracking(id, b)
  return NextResponse.json({ contract: c })
}
