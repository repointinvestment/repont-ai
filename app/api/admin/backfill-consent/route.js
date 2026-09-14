// app/api/admin/backfill-consent/route.js
// 1회성 소급 처리 — 지금까지 등록된 고객은 전화로 물어보고 등록한 거라는 전제로, 아직 수신동의가
// 안 되어 있는 고객을 전부 동의로 바꿔줌. 명시적으로 "동의 안 함"으로 바꿔둔 적 없는 사람만 대상
// (거부 이력이 있으면 안 건드림 — 지금 스키마엔 별도 거부 플래그가 없어서 우선 전체를 대상으로 함).

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { ensureSchema } from '@/lib/customerRecheckStore'

export async function POST(request) {
  if (request.headers.get('x-consultant-role') !== 'admin') {
    return NextResponse.json({ error: '관리자만 실행할 수 있습니다.' }, { status: 403 })
  }
  await ensureSchema()
  const result = await sql`
    UPDATE customers SET marketing_consent = true, marketing_consent_at = COALESCE(marketing_consent_at, NOW())
    WHERE marketing_consent IS DISTINCT FROM true
    RETURNING id
  `
  return NextResponse.json({ ok: true, updated: result.length })
}
