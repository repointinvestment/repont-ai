// app/api/public/materials/[id]/inquire/route.js
// 안내자료 페이지의 "문의하기" 버튼 — 토큰으로 알아본 기존 고객이면 자동으로 그 고객 기록에 남고,
// 모르는 사람(토큰 없음)이면 이름·연락처를 받아서 새 리드로 등록.

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { logInquiry, getMaterial } from '@/lib/materialsStore'

export async function POST(request, { params }) {
  const materialId = Number(params.id)
  const material = await getMaterial(materialId)
  if (!material) return NextResponse.json({ error: '자료를 찾을 수 없습니다.' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const { token, name, phone } = body

  if (token) {
    const [customer] = await sql`SELECT id, memo FROM customers WHERE public_token = ${token}`
    if (customer) {
      await logInquiry(materialId, { customerId: customer.id })
      const stamp = new Date().toLocaleString('ko-KR')
      const note = `[안내자료 문의] "${material.title}" — ${stamp}`
      const nextMemo = customer.memo ? `${customer.memo}\n${note}` : note
      await sql`UPDATE customers SET memo = ${nextMemo}, updated_at = NOW() WHERE id = ${customer.id}`
      return NextResponse.json({ ok: true })
    }
  }

  // 토큰이 없거나 유효하지 않으면(낯선 사람이 공유받아 본 경우) 새 리드로 등록
  if (!name?.trim() || !phone?.trim()) {
    return NextResponse.json({ error: 'needName' }, { status: 200 }) // 클라이언트가 이름/연락처 입력 폼을 띄우도록
  }
  await sql`
    INSERT INTO customers (consultant_id, owner_name, phone, memo, status)
    VALUES (${material.consultant_username}, ${name}, ${phone}, ${`[안내자료 문의] "${material.title}"으로 유입`}, '상담중')
  `
  await logInquiry(materialId, { name, phone })
  return NextResponse.json({ ok: true })
}
