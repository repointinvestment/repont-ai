// app/api/customers/[id]/applications/route.js
// 이 고객의 자금 신청 파이프라인 — 목록 조회 / 신규 접수 생성. 담당 컨설턴트 본인 또는 관리자만.

import { NextResponse } from 'next/server'
import { listApplications, createApplication } from '@/lib/applicationsStore'
import { requireCustomerOwnership } from '@/lib/authz'

export async function GET(request, { params }) {
  const check = await requireCustomerOwnership(Number(params.id), request)
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status })
  const apps = await listApplications(Number(params.id))
  return NextResponse.json({ applications: apps })
}

export async function POST(request, { params }) {
  const check = await requireCustomerOwnership(Number(params.id), request)
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status })
  const body = await request.json().catch(() => ({}))
  if (!body.fundName?.trim()) return NextResponse.json({ error: '자금명은 필수입니다.' }, { status: 400 })
  const app = await createApplication(Number(params.id), body, request.headers.get('x-consultant-id') || null)
  return NextResponse.json({ application: app })
}
