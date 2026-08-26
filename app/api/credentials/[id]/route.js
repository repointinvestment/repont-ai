// app/api/credentials/[id]/route.js
// 담당 컨설턴트 본인 또는 admin만 계정정보 삭제 가능

import { sql } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function DELETE(request, { params }) {
  const { id } = params
  const consultantId = request.headers.get('x-consultant-id')
  const role = request.headers.get('x-consultant-role')

  const rows = await sql`
    SELECT cc.id, c.consultant_id
    FROM customer_credentials cc
    JOIN customers c ON c.id = cc.customer_id
    WHERE cc.id = ${id}
  `

  if (rows.length === 0) {
    return NextResponse.json({ error: '계정정보를 찾을 수 없습니다.' }, { status: 404 })
  }

  const isOwner = String(rows[0].consultant_id) === String(consultantId)
  const isAdmin = role === 'admin'
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }

  await sql`DELETE FROM customer_credentials WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
