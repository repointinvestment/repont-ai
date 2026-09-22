// app/api/public/subscribe/route.js
// 신청(구독) 액션 — 고객이 문자로 받은 개인 링크에서 "신청하기" 버튼을 누르면 호출됨.
// 이 시점(alert_subscribed_at)이 카카오가 요구하는 "수신자 본인의 액션" 그 자체가 됨.

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('t')
  if (!token) return NextResponse.json({ error: '토큰이 필요합니다.' }, { status: 400 })
  const [customer] = await sql`SELECT owner_name, alert_subscribed_at FROM customers WHERE public_token = ${token}`
  if (!customer) return NextResponse.json({ error: '유효하지 않은 링크입니다.' }, { status: 404 })
  return NextResponse.json({ ownerName: customer.owner_name, subscribed: !!customer.alert_subscribed_at })
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}))
  const token = body.token
  if (!token) return NextResponse.json({ error: '토큰이 필요합니다.' }, { status: 400 })
  const [customer] = await sql`SELECT id FROM customers WHERE public_token = ${token}`
  if (!customer) return NextResponse.json({ error: '유효하지 않은 링크입니다.' }, { status: 404 })
  await sql`UPDATE customers SET alert_subscribed_at = NOW() WHERE id = ${customer.id}`
  return NextResponse.json({ ok: true })
}
