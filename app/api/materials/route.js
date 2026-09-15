// app/api/materials/route.js
// 내 안내자료 목록 조회 / 신규 생성 — 본인 것만.

import { NextResponse } from 'next/server'
import { listMaterials, createMaterial } from '@/lib/materialsStore'

export async function GET(request) {
  const username = request.headers.get('x-consultant-id')
  if (!username) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  const materials = await listMaterials(username)
  return NextResponse.json({ materials })
}

export async function POST(request) {
  const username = request.headers.get('x-consultant-id')
  if (!username) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  if (!body.title?.trim()) return NextResponse.json({ error: '제목은 필수입니다.' }, { status: 400 })
  const material = await createMaterial(username, body)
  return NextResponse.json({ material })
}
