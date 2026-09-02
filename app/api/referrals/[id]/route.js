// app/api/referrals/[id]/route.js
// 의뢰 건 상태 변경(대기→처리중→완료) — 관리자 화면에서 사용.

import { NextResponse } from 'next/server'
import { updateReferralStatus } from '@/lib/referralsStore'

export async function PATCH(request, { params }) {
  const body = await request.json().catch(() => ({}))
  const r = await updateReferralStatus(Number(params.id), body)
  if (!r) return NextResponse.json({ error: '의뢰 건을 찾을 수 없습니다.' }, { status: 404 })
  return NextResponse.json({ referral: r })
}
