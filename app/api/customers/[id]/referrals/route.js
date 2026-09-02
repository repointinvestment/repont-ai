// app/api/customers/[id]/referrals/route.js
// 이 고객의 "대표 의뢰" 이력 조회 / 신규 의뢰 생성.

import { NextResponse } from 'next/server'
import { listReferralsForCustomer, createReferral } from '@/lib/referralsStore'

export async function GET(request, { params }) {
  const referrals = await listReferralsForCustomer(Number(params.id))
  return NextResponse.json({ referrals })
}

export async function POST(request, { params }) {
  const body = await request.json().catch(() => ({}))
  if (!body.issueType) return NextResponse.json({ error: '이슈 유형은 필수입니다.' }, { status: 400 })
  const r = await createReferral(Number(params.id), body, request.headers.get('x-consultant-id') || null)
  return NextResponse.json({ referral: r })
}
