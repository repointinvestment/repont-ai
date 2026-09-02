// app/api/policy-funds/route.js
// 정책자금 마스터 DB — 목록 조회(모든 로그인 사용자) / 신규 추가(관리자).
// 다른 API들과 같은 방식으로 x-consultant-role 헤더로 관리자 여부를 봄.

import { NextResponse } from 'next/server'
import { listFunds, listCommonRules, createFund } from '@/lib/policyFundsStore'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const activeOnly = searchParams.get('active') === '1'
  const [funds, rules] = await Promise.all([listFunds({ activeOnly }), listCommonRules()])
  return NextResponse.json({ funds, rules })
}

export async function POST(request) {
  if (request.headers.get('x-consultant-role') !== 'admin') {
    return NextResponse.json({ error: '관리자만 추가할 수 있습니다.' }, { status: 403 })
  }
  const body = await request.json().catch(() => ({}))
  if (!body.name) return NextResponse.json({ error: '자금명은 필수입니다.' }, { status: 400 })
  const fund = await createFund({ ...body, updated_by: request.headers.get('x-consultant-id') || 'admin' })
  if (!fund) return NextResponse.json({ error: '이미 같은 key의 자금이 있습니다.' }, { status: 409 })
  return NextResponse.json({ fund })
}
