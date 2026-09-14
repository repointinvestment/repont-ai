// app/api/public/customer-snapshot/inquire/route.js
// 재방문 고객이 "상담 요청하기" 누르면, 새 고객으로 중복 등록하지 않고 기존 고객 메모에
// 재문의 시점만 기록 — 담당 컨설턴트가 다음에 볼 때 "아 이 사람 다시 관심 보였구나" 알 수 있게.

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function POST(request) {
  const body = await request.json().catch(() => ({}))
  const token = body.token
  if (!token) return NextResponse.json({ error: '토큰이 필요합니다.' }, { status: 400 })

  const [customer] = await sql`SELECT id, memo FROM customers WHERE public_token = ${token}`
  if (!customer) return NextResponse.json({ error: '유효하지 않은 링크입니다.' }, { status: 404 })

  const stamp = new Date().toLocaleString('ko-KR')
  const note = `[머니콕 재문의] ${stamp}`
  const nextMemo = customer.memo ? `${customer.memo}\n${note}` : note
  await sql`UPDATE customers SET memo = ${nextMemo}, updated_at = NOW() WHERE id = ${customer.id}`
  return NextResponse.json({ ok: true })
}
