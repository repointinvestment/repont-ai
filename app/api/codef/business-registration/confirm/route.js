// app/api/codef/business-registration/confirm/route.js
// CODEF "사업자등록 증명 API" 2차(추가인증) 확인 요청.
// 사용자가 카카오톡 등에서 인증을 승인한 뒤 이 라우트를 호출하면 CODEF가 실제 증명서 데이터를 내려줌.
// CODEF 쪽 간편인증 타임아웃이 최대 4분 30초(270초)라 이 함수도 오래 걸릴 수 있음 —
// Vercel Hobby 플랜은 함수 실행시간이 10초로 제한되어 타임아웃날 수 있으니, 실사용 전 Pro 플랜 여부 확인 필요.

export const maxDuration = 300

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { callCodef, needsTwoWay } from '@/lib/codef'

const PRODUCT_PATH = '/v1/kr/public/nt/proof-issue/corporate-registration'

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
    simpleAuth: '1', // 사용자가 인증을 승인했다고 가정 (취소하려면 '0')
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

  // 드물게 한 번 더 추가인증을 요구하는 경우 — pending 유지하고 그대로 반환
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

  return NextResponse.json({ status: isSuccess ? 'done' : 'error', result })
}
