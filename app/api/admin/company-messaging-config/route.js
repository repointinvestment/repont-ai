// app/api/admin/company-messaging-config/route.js
// 회사 공용 솔라피 계정 설정(관리자 전용, 1회성) — API키·시크릿·템플릿ID·발신번호.

import { NextResponse } from 'next/server'
import { getCompanyConfigForDisplay, upsertCompanyConfig } from '@/lib/companyMessagingConfig'

function requireAdmin(request) {
  return request.headers.get('x-consultant-role') === 'admin'
}

export async function GET(request) {
  if (!requireAdmin(request)) return NextResponse.json({ error: '관리자만 조회할 수 있습니다.' }, { status: 403 })
  const config = await getCompanyConfigForDisplay()
  return NextResponse.json({ config })
}

export async function PUT(request) {
  if (!requireAdmin(request)) return NextResponse.json({ error: '관리자만 저장할 수 있습니다.' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  const row = await upsertCompanyConfig(body)
  return NextResponse.json({ ok: true, updatedAt: row.updated_at })
}
