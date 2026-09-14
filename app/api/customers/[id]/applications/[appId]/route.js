// app/api/customers/[id]/applications/[appId]/route.js
// 개별 접수 건 — 단계 변경(부결 시 재신청일 자동계산 포함) / 상세 수정 / 삭제. 담당 컨설턴트 본인 또는 관리자만.

import { NextResponse } from 'next/server'
import { updateStage, updateApplication, deleteApplication, listEvents } from '@/lib/applicationsStore'
import { requireCustomerOwnership } from '@/lib/authz'

export async function PATCH(request, { params }) {
  const check = await requireCustomerOwnership(Number(params.id), request)
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status })
  const body = await request.json().catch(() => ({}))
  const updatedBy = request.headers.get('x-consultant-id') || null
  if (body.stage) {
    const app = await updateStage(Number(params.appId), body, updatedBy)
    if (!app) return NextResponse.json({ error: '접수 건을 찾을 수 없습니다.' }, { status: 404 })
    return NextResponse.json({ application: app })
  }
  const app = await updateApplication(Number(params.appId), body)
  if (!app) return NextResponse.json({ error: '접수 건을 찾을 수 없습니다.' }, { status: 404 })
  return NextResponse.json({ application: app })
}

export async function DELETE(request, { params }) {
  const check = await requireCustomerOwnership(Number(params.id), request)
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status })
  await deleteApplication(Number(params.appId))
  return NextResponse.json({ ok: true })
}

export async function GET(request, { params }) {
  const check = await requireCustomerOwnership(Number(params.id), request)
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status })
  const events = await listEvents(Number(params.appId))
  return NextResponse.json({ events })
}
