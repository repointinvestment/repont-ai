// app/api/public/materials/[id]/route.js
// 고객이 카톡 링크로 들어와서 보는 안내자료 — 로그인 불필요. 제목·블록 내용만 내려주고
// 컨설턴트 아이디는 노출 안 함(문의하기는 별도 라우트에서 material_id로만 처리).

import { NextResponse } from 'next/server'
import { getMaterial } from '@/lib/materialsStore'

export async function GET(request, { params }) {
  const material = await getMaterial(Number(params.id))
  if (!material) return NextResponse.json({ error: '자료를 찾을 수 없습니다.' }, { status: 404 })
  return NextResponse.json({ material: { id: material.id, title: material.title, blocks: material.blocks } })
}
