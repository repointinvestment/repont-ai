// app/api/policy-funds/cases/[id]/route.js
// 정책자금 실무 사례 — 개별 조회/수정/삭제 (수정·삭제는 관리자 전용).

import { NextResponse } from 'next/server'
import { getCase, updateCase, deleteCase } from '@/lib/policyFundsStore'

function requireAdmin(request) {
  return request.headers.get('x-consultant-role') === 'admin'
}

export async function GET(request, { params }) {
  const c = await getCase(Number(params.id))
  if (!c) return NextResponse.json({ error: '사례를 찾을 수 없습니다.' }, { status: 404 })
  return NextResponse.json({ case: c })
}

export async function PUT(request, { params }) {
  if (!requireAdmin(request)) return NextResponse.json({ error: '관리자만 수정할 수 있습니다.' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  if (!body.title?.trim()) return NextResponse.json({ error: '사례 제목은 필수입니다.' }, { status: 400 })
  const c = await updateCase(Number(params.id), body)
  if (!c) return NextResponse.json({ error: '사례를 찾을 수 없습니다.' }, { status: 404 })
  return NextResponse.json({ case: c })
}

export async function DELETE(request, { params }) {
  if (!requireAdmin(request)) return NextResponse.json({ error: '관리자만 삭제할 수 있습니다.' }, { status: 403 })
  await deleteCase(Number(params.id))
  return NextResponse.json({ ok: true })
}
