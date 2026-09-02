// app/api/policy-funds/[id]/route.js
// 정책자금 마스터 DB — 개별 자금 수정/삭제 (관리자 전용).

import { NextResponse } from 'next/server'
import { getFund, updateFund, deleteFund } from '@/lib/policyFundsStore'

function requireAdmin(request) {
  return request.headers.get('x-consultant-role') === 'admin'
}

export async function GET(request, { params }) {
  const fund = await getFund(Number(params.id))
  if (!fund) return NextResponse.json({ error: '자금을 찾을 수 없습니다.' }, { status: 404 })
  return NextResponse.json({ fund })
}

export async function PUT(request, { params }) {
  if (!requireAdmin(request)) return NextResponse.json({ error: '관리자만 수정할 수 있습니다.' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  if (!body.name) return NextResponse.json({ error: '자금명은 필수입니다.' }, { status: 400 })
  const fund = await updateFund(Number(params.id), { ...body, updated_by: request.headers.get('x-consultant-id') || 'admin' })
  if (!fund) return NextResponse.json({ error: '자금을 찾을 수 없습니다.' }, { status: 404 })
  return NextResponse.json({ fund })
}

export async function DELETE(request, { params }) {
  if (!requireAdmin(request)) return NextResponse.json({ error: '관리자만 삭제할 수 있습니다.' }, { status: 403 })
  await deleteFund(Number(params.id))
  return NextResponse.json({ ok: true })
}
