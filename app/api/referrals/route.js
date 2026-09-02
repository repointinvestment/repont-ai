// app/api/referrals/route.js
// 전체 "대표 의뢰함" 목록 (관리자 화면용). ?status=대기 로 필터 가능.

import { NextResponse } from 'next/server'
import { listReferrals } from '@/lib/referralsStore'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const referrals = await listReferrals({ status })
  return NextResponse.json({ referrals })
}
