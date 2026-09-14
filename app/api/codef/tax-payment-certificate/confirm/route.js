// app/api/codef/tax-payment-certificate/confirm/route.js
// CODEF "납세증명서 API" 2차(추가인증) 확인 요청. 다른 문서들과 구조 동일.

export const maxDuration = 300

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { callCodef, needsTwoWay } from '@/lib/codef'
import { saveIssuedPdfs } from '@/lib/codefSave'

const PRODUCT_PATH = '/v1/kr/public/nt/proof-issue/tax-cert-all'
const FILE_LABEL = '납세증명서'

export async function POST(request) {
  const { sessionId } = await request.json().catch(() => ({}))
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId가 필요합니다.' }, { status: 400 })
  }

  const [session] = await sql`SELECT * FROM codef_auth_sessions WHERE id = ${sessionId}`
  if (!session) {
    return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 })
  }
  // sessionId는 순번이라 추측 가능 — 인증 헤더와 세션을 만든 사람이 일치하는지(또는 관리자인지) 확인 안 하면
  // 남이 만든 세션의 sessionId를 추측해서 발급된 서류 원문을 가로챌 수 있었음.
  const confirmConsultantId = request.headers.get('x-consultant-id')
  const confirmRole = request.headers.get('x-consultant-role')
  if (!confirmConsultantId) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  if (session.created_by && confirmRole !== 'admin' && String(session.created_by) !== String(confirmConsultantId)) {
    return NextResponse.json({ error: '본인이 요청한 세션만 확인할 수 있습니다.' }, { status: 403 })
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
    result = await callCodef(PRODUCT_PATH, confirmPayload)
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
    savedFiles = await saveIssuedPdfs(session.customer_id, result, session.created_by, FILE_LABEL)
  }

  return NextResponse.json({ status: isSuccess ? 'done' : 'error', result, savedFiles })
}
