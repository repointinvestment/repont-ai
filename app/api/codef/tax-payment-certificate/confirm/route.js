// app/api/codef/tax-payment-certificate/confirm/route.js
// CODEF "납세증명서 API" 2차(추가인증) 확인 요청. 다른 문서들과 구조 동일.

export const maxDuration = 300

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { put } from '@vercel/blob'
import { callCodef, needsTwoWay } from '@/lib/codef'

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
    savedFiles = await saveIssuedPdfs(session.customer_id, result, session.created_by)
  }

  return NextResponse.json({ status: isSuccess ? 'done' : 'error', result, savedFiles })
}

function saveIssuedPdfs(customerId, result, uploadedBy) {
  const items = Array.isArray(result.data) ? result.data : result.data ? [result.data] : []
  return Promise.all(
    items
      .filter((item) => item.resOriGinalData1)
      .map(async (item) => {
        try {
          const buffer = Buffer.from(item.resOriGinalData1, 'base64')
          const companyName = (item.resCompanyNm || item.resUserNm || FILE_LABEL).replace(/[/\\?%*:|"<>]/g, '')
          const fileName = `${FILE_LABEL}_${companyName}_${item.resIssueDate || Date.now()}.pdf`

          const blob = await put(`customers/${customerId}/${Date.now()}-${fileName}`, buffer, {
            access: 'private',
            contentType: 'application/pdf',
          })

          const [row] = await sql`
            INSERT INTO customer_files (customer_id, file_name, blob_url, size_bytes, uploaded_by)
            VALUES (${customerId}, ${fileName}, ${blob.pathname}, ${buffer.length}, ${uploadedBy || 'CODEF 자동수집'})
            RETURNING id, file_name
          `
          return { ...row, companyName: item.resCompanyNm || item.resUserNm || '' }
        } catch (err) {
          console.error('CODEF PDF 파일함 저장 실패:', err)
          return null
        }
      })
  ).then((rows) => rows.filter(Boolean))
}
