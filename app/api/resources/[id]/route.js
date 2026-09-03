// app/api/resources/[id]/route.js
// 자료 삭제 — 관리자만.

import { sql } from '@/lib/db'
import { del } from '@vercel/blob'
import { NextResponse } from 'next/server'

export async function DELETE(request, { params }) {
  if (request.headers.get('x-consultant-role') !== 'admin') {
    return NextResponse.json({ error: '관리자만 삭제할 수 있습니다.' }, { status: 403 })
  }
  const rows = await sql`SELECT blob_url FROM resource_files WHERE id = ${params.id}`
  if (rows.length === 0) return NextResponse.json({ error: '자료를 찾을 수 없습니다.' }, { status: 404 })
  await del(rows[0].blob_url)
  await sql`DELETE FROM resource_files WHERE id = ${params.id}`
  return NextResponse.json({ ok: true })
}

export async function PATCH(request, { params }) {
  if (request.headers.get('x-consultant-role') !== 'admin') {
    return NextResponse.json({ error: '관리자만 수정할 수 있습니다.' }, { status: 403 })
  }
  const body = await request.json().catch(() => ({}))
  const [row] = await sql`UPDATE resource_files SET description = ${body.description ?? null} WHERE id = ${params.id} RETURNING *`
  if (!row) return NextResponse.json({ error: '자료를 찾을 수 없습니다.' }, { status: 404 })
  return NextResponse.json({ file: row })
}
