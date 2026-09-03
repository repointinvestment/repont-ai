// app/api/customers/[id]/contracts/route.js
// 이 고객과 맺은 계약 목록 조회 / 신규 생성 — 그 고객 담당 컨설턴트(consultant_id) 본인 또는 관리자만.

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { listContractsForCustomer, createContract } from '@/lib/contractsStore'

async function checkOwnership(customerId, request) {
  const [customer] = await sql`SELECT consultant_id, owner_name, business_name FROM customers WHERE id = ${customerId}`
  if (!customer) return { ok: false, status: 404, error: '고객을 찾을 수 없습니다.' }
  const username = request.headers.get('x-consultant-id')
  const role = request.headers.get('x-consultant-role')
  if (role !== 'admin' && String(customer.consultant_id) !== String(username)) {
    return { ok: false, status: 403, error: '본인 고객의 계약만 조회·생성할 수 있습니다.' }
  }
  return { ok: true, customer }
}

export async function GET(request, { params }) {
  const id = Number(params.id)
  const check = await checkOwnership(id, request)
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status })
  const contracts = await listContractsForCustomer(id)
  return NextResponse.json({ contracts })
}

export async function POST(request, { params }) {
  const id = Number(params.id)
  const check = await checkOwnership(id, request)
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status })
  const body = await request.json().catch(() => ({}))
  const consultantUsername = request.headers.get('x-consultant-id')
  const contract = await createContract({
    customerId: id,
    customerName: check.customer.owner_name,
    businessName: check.customer.business_name,
    consultantUsername,
    consultantName: body.consultantName,
    feeAmount: body.feeAmount,
    feeStructure: body.feeStructure,
    successFeePct: body.successFeePct,
  })
  return NextResponse.json({ contract })
}
