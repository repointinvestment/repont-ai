// app/api/referrals/route.js
// 전체 "대표 의뢰함" 목록 (관리자 전용). ?status=대기 로 필터 가능.

import { NextResponse } from 'next/server'
import { listReferrals } from '@/lib/referralsStore'

export async function GET(request) {
  if (request.headers.get('x-consultant-role') !== 'admin') {
    return NextResponse.json({ error: '관리자만 조회할 수 있습니다.' }, { status: 403 })
  }
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const referrals = await listReferrals({ status })
  return NextResponse.json({ referrals })
}
