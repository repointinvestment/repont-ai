// app/api/referrals/mine/route.js
// 본인이 보낸 "대표 의뢰" 이력만 조회 — 다른 사람 것은 보이지 않음(created_by로 필터).
// 관리자 권한 불필요: 자기 자신의 데이터라 x-consultant-id만 있으면 됨.

import { NextResponse } from 'next/server'
import { listReferralsByCreator } from '@/lib/referralsStore'

export async function GET(request) {
  const username = request.headers.get('x-consultant-id')
  if (!username) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  const referrals = await listReferralsByCreator(username)
  return NextResponse.json({ referrals })
}
