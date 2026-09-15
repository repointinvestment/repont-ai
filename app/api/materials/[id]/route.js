// app/api/materials/[id]/route.js
// 안내자료 상세(본인 것만)·수정·삭제.

import { NextResponse } from 'next/server'
import { getMaterial, updateMaterial, deleteMaterial, listInquiries } from '@/lib/materialsStore'

async function checkOwnership(id, request) {
  const material = await getMaterial(id)
  if (!material) return { ok: false, status: 404, error: '자료를 찾을 수 없습니다.' }
  const username = request.headers.get('x-consultant-id')
  const role = request.headers.get('x-consultant-role')
  if (role !== 'admin' && String(material.consultant_username) !== String(username)) {
    return { ok: false, status: 403, error: '본인이 만든 자료만 접근할 수 있습니다.' }
  }
  return { ok: true, material }
}

export async function GET(request, { params }) {
  const check = await checkOwnership(Number(params.id), request)
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status })
  const inquiries = await listInquiries(Number(params.id))
  return NextResponse.json({ material: check.material, inquiries })
}

export async function PATCH(request, { params }) {
  const check = await checkOwnership(Number(params.id), request)
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status })
  const body = await request.json().catch(() => ({}))
  const material = await updateMaterial(Number(params.id), body)
  return NextResponse.json({ material })
}

export async function DELETE(request, { params }) {
  const check = await checkOwnership(Number(params.id), request)
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status })
  await deleteMaterial(Number(params.id))
  return NextResponse.json({ ok: true })
}
