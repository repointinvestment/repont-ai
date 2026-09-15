// app/api/admin/materials/route.js
// 관리자 전용 — 전체 컨설턴트가 만든 안내자료와 문의 건수. 성과관리용.

import { NextResponse } from 'next/server'
import { listAllMaterials } from '@/lib/materialsStore'

export async function GET(request) {
  if (request.headers.get('x-consultant-role') !== 'admin') {
    return NextResponse.json({ error: '관리자만 조회할 수 있습니다.' }, { status: 403 })
  }
  const materials = await listAllMaterials()
  return NextResponse.json({ materials })
}
