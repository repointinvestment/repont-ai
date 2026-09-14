// app/api/customers/[id]/referrals/route.js
// 이 고객의 "대표 의뢰" 이력 조회 / 신규 의뢰 생성. 담당 컨설턴트 본인 또는 관리자만.

import { NextResponse } from 'next/server'
import { listReferralsForCustomer, createReferral } from '@/lib/referralsStore'
import { requireCustomerOwnership } from '@/lib/authz'

export async function GET(request, { params }) {
  const check = await requireCustomerOwnership(Number(params.id), request)
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status })
  const referrals = await listReferralsForCustomer(Number(params.id))
  return NextResponse.json({ referrals })
}

export async function POST(request, { params }) {
  const check = await requireCustomerOwnership(Number(params.id), request)
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status })
  const body = await request.json().catch(() => ({}))
  if (!body.issueType) return NextResponse.json({ error: '이슈 유형은 필수입니다.' }, { status: 400 })
  const r = await createReferral(Number(params.id), body, request.headers.get('x-consultant-id') || null)
  return NextResponse.json({ referral: r })
}
