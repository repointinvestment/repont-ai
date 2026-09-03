// app/api/referrals/[id]/route.js
// 의뢰 건 상태 변경(대기→처리중→완료) — 관리자 전용.

import { NextResponse } from 'next/server'
import { updateReferralStatus } from '@/lib/referralsStore'

export async function PATCH(request, { params }) {
  if (request.headers.get('x-consultant-role') !== 'admin') {
    return NextResponse.json({ error: '관리자만 상태를 변경할 수 있습니다.' }, { status: 403 })
  }
  const body = await request.json().catch(() => ({}))
  const r = await updateReferralStatus(Number(params.id), body)
  if (!r) return NextResponse.json({ error: '의뢰 건을 찾을 수 없습니다.' }, { status: 404 })
  return NextResponse.json({ referral: r })
}
