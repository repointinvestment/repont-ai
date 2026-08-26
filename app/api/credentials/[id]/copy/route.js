// app/api/credentials/[id]/copy/route.js
// 담당 컨설턴트 본인 또는 admin만 계정정보 복호화하여 조회 가능

import { sql } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { NextResponse } from 'next/server'

export async function POST(request, { params }) {
  const { id } = params
  const consultantId = request.headers.get('x-consultant-id')
  const role = request.headers.get('x-consultant-role')
  const body = await request.json().catch(() => ({}))
  const field = body.field === 'secondary' ? 'secondary' : 'password'

  const rows = await sql`
    SELECT cc.id, cc.service_name, cc.password_encrypted, cc.secondary_password_encrypted, c.consultant_id
    FROM customer_credentials cc
    JOIN customers c ON c.id = cc.customer_id
    WHERE cc.id = ${id}
  `

  if (rows.length === 0) {
    return NextResponse.json({ error: '계정정보를 찾을 수 없습니다.' }, { status: 404 })
  }

  const credential = rows[0]
  const isOwner = String(credential.consultant_id) === String(consultantId)
  const isAdmin = role === 'admin'

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }

  const encryptedValue = field === 'secondary' ? credential.secondary_password_encrypted : credential.password_encrypted
  if (!encryptedValue) {
    return NextResponse.json({ error: '저장된 값이 없습니다.' }, { status: 404 })
  }
  const decryptedValue = decrypt(encryptedValue)

  return NextResponse.json({
    credentialType: credential.service_name,
    value: decryptedValue,
  })
}
