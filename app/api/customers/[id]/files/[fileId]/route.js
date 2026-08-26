// app/api/customers/[id]/files/[fileId]/route.js
import { sql } from '@/lib/db'
import { del } from '@vercel/blob'
import { NextResponse } from 'next/server'

export async function DELETE(request, { params }) {
  const { fileId } = params
  const rows = await sql`SELECT blob_url FROM customer_files WHERE id = ${fileId}`
  if (rows.length === 0) {
    return NextResponse.json({ error: '파일을 찾을 수 없습니다.' }, { status: 404 })
  }
  await del(rows[0].blob_url)
  await sql`DELETE FROM customer_files WHERE id = ${fileId}`
  return NextResponse.json({ ok: true })
}
