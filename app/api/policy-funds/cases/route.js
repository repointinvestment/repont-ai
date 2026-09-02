// app/api/policy-funds/cases/route.js
// 정책자금 실무 사례 DB — 목록 조회(모든 로그인 사용자) / 신규 추가(관리자).
// ?fund_key=… / ?outcome=… 으로 필터 가능.

import { NextResponse } from 'next/server'
import { listCases, createCase } from '@/lib/policyFundsStore'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const cases = await listCases({
    fundKey: searchParams.get('fund_key') || null,
    outcome: searchParams.get('outcome') || null,
  })
  return NextResponse.json({ cases })
}

export async function POST(request) {
  if (request.headers.get('x-consultant-role') !== 'admin') {
    return NextResponse.json({ error: '관리자만 추가할 수 있습니다.' }, { status: 403 })
  }
  const body = await request.json().catch(() => ({}))
  if (!body.title?.trim()) return NextResponse.json({ error: '사례 제목은 필수입니다.' }, { status: 400 })
  const c = await createCase({ ...body, created_by: request.headers.get('x-consultant-id') || 'admin' })
  return NextResponse.json({ case: c })
}
