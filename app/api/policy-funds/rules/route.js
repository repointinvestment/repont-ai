// app/api/policy-funds/rules/route.js
// 정책자금 공통 규칙(소상공인 기준, 매출초과차입금, 보증기관 중복금지 등) 조회/수정.

import { NextResponse } from 'next/server'
import { listCommonRules, upsertCommonRule, deleteCommonRule, ensureSchema } from '@/lib/policyFundsStore'

function requireAdmin(request) {
  return request.headers.get('x-consultant-role') === 'admin'
}

export async function GET() {
  const rules = await listCommonRules()
  return NextResponse.json({ rules })
}

export async function PUT(request) {
  if (!requireAdmin(request)) return NextResponse.json({ error: '관리자만 수정할 수 있습니다.' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  if (!body.key || !body.title) return NextResponse.json({ error: 'key와 제목은 필수입니다.' }, { status: 400 })
  await ensureSchema()
  const rule = await upsertCommonRule({ ...body, updated_by: request.headers.get('x-consultant-id') || 'admin' })
  return NextResponse.json({ rule })
}

export async function DELETE(request) {
  if (!requireAdmin(request)) return NextResponse.json({ error: '관리자만 삭제할 수 있습니다.' }, { status: 403 })
  const { searchParams } = new URL(request.url)
  const key = searchParams.get('key')
  if (!key) return NextResponse.json({ error: 'key가 필요합니다.' }, { status: 400 })
  await deleteCommonRule(key)
  return NextResponse.json({ ok: true })
}
