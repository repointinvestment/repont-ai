// app/api/materials/[id]/clone/route.js
// 다른 컨설턴트가 만든 자료를 내 것으로 복제 — 관리자는 전체 자료를 복제할 수 있고(전체 조회 권한 있음),
// 일반 컨설턴트는 원래 자기 자료만 볼 수 있어서 사실상 본인 자료 복제만 가능.

import { NextResponse } from 'next/server'
import { getMaterial, createMaterial } from '@/lib/materialsStore'

export async function POST(request, { params }) {
  const username = request.headers.get('x-consultant-id')
  const role = request.headers.get('x-consultant-role')
  if (!username) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const source = await getMaterial(Number(params.id))
  if (!source) return NextResponse.json({ error: '자료를 찾을 수 없습니다.' }, { status: 404 })
  if (role !== 'admin' && String(source.consultant_username) !== String(username)) {
    return NextResponse.json({ error: '이 자료를 복제할 권한이 없습니다.' }, { status: 403 })
  }

  const cloned = await createMaterial(username, { title: `${source.title} (복사본)`, blocks: source.blocks })
  return NextResponse.json({ material: cloned })
}
