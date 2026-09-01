// app/api/codef/localtax-payment-certificate/confirm/route.js
// CODEF "지방세 납세증명 조회 API" 2차(추가인증) 확인 요청. 다른 문서들과 구조 동일
// (간편인증 경로만 지원 — 공동/금융인증서 전자서명 추가인증 경로는 이 앱에서 사용 안 함).

export const maxDuration = 300

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { callCodef, needsTwoWay, PRODUCTS } from '@/lib/codef'
import { saveIssuedPdfs } from '@/lib/codefSave'

const PRODUCT_KEY = 'localtax-payment-certificate'
const PRODUCT = PRODUCTS[PRODUCT_KEY]

export async function POST(request) {
  const { sessionId } = await request.json().catch(() => ({}))
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId가 필요합니다.' }, { status: 400 })
  }

  const [session] = await sql`SELECT * FROM codef_auth_sessions WHERE id = ${sessionId}`
  if (!session) {
    return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 })
  }
  if (session.status !== 'pending') {
    return NextResponse.json({ error: `이미 처리된 세션입니다 (status: ${session.status}).` }, { status: 409 })
  }

  const confirmPayload = {
    ...session.request_payload,
    simpleAuth: '1',
    is2Way: true,
    twoWayInfo: {
      jobIndex: session.job_index,
      threadIndex: session.thread_index,
      jti: session.jti,
      twoWayTimestamp: session.two_way_timestamp,
    },
  }

  let result
  try {
    result = await callCodef(PRODUCT.path, confirmPayload)
  } catch (err) {
    await sql`UPDATE codef_auth_sessions SET status = 'failed', result_payload = ${JSON.stringify({ error: err.message })} WHERE id = ${sessionId}`
    return NextResponse.json({ error: `CODEF 확인 요청 실패: ${err.message}` }, { status: 502 })
  }

  if (needsTwoWay(result)) {
    await sql`
      UPDATE codef_auth_sessions
      SET job_index = ${result.data?.jobIndex ?? session.job_index},
          thread_index = ${result.data?.threadIndex ?? session.thread_index},
          jti = ${result.data?.jti ?? session.jti},
          two_way_timestamp = ${result.data?.twoWayTimestamp ?? session.two_way_timestamp},
          result_payload = ${JSON.stringify(result)}
      WHERE id = ${sessionId}
    `
    return NextResponse.json({ status: 'pending_2way', sessionId, raw: result })
  }

  const isSuccess = result?.result?.code === 'CF-00000'
  await sql`
    UPDATE codef_auth_sessions
    SET status = ${isSuccess ? 'confirmed' : 'failed'}, result_payload = ${JSON.stringify(result)}
    WHERE id = ${sessionId}
  `

  let savedFiles = []
  if (isSuccess && session.customer_id) {
    savedFiles = await saveIssuedPdfs(session.customer_id, result, session.created_by, PRODUCT.fileLabel)
  }

  return NextResponse.json({ status: isSuccess ? 'done' : 'error', result, savedFiles })
}
