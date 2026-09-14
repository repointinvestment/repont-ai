import { NextResponse } from 'next/server'
import { submitRequest, getChannel } from '@/lib/consultantChannelStore'

export async function GET(request) {
  const username = request.headers.get('x-consultant-id')
  if (!username) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  const channel = await getChannel(username)
  return NextResponse.json({ channel })
}

export async function POST(request) {
  const username = request.headers.get('x-consultant-id')
  if (!username) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  if (!body.businessName?.trim() || !body.phone?.trim()) {
    return NextResponse.json({ error: '상호명과 연락처는 필수입니다.' }, { status: 400 })
  }
  const row = await submitRequest(username, body)
  return NextResponse.json({ ok: true, channel: row })
}
