// app/api/codef/tax-payment-certificate/route.js
// CODEF "납세증명서 API" 1차 요청. 사업자등록증명과 마찬가지로 비회원 간편인증(loginType=6) 지원.
// 주의: 이 상품은 생년월일 필드명이 다른 문서들과 달리 'loginBirthDate' (다른 곳은 'birthDate').

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { callCodef, rsaEncrypt, needsTwoWay } from '@/lib/codef'

const PRODUCT_PATH = '/v1/kr/public/nt/proof-issue/tax-cert-all'

export async function POST(request) {
  const consultantId = request.headers.get('x-consultant-id')
  const body = await request.json().catch(() => ({}))
  const {
    customerId,
    userName,
    residentNo,
    phoneNo,
    loginTypeLevel,
    telecom,
    sharedId,
    loginType,
  } = body

  if (!userName || !residentNo || !phoneNo) {
    return NextResponse.json({ error: '이름, 주민등록번호, 휴대폰번호는 필수입니다.' }, { status: 400 })
  }

  const digits = residentNo.replace(/[^0-9]/g, '')
  if (digits.length !== 13) {
    return NextResponse.json({ error: '주민등록번호는 숫자 13자리여야 합니다.' }, { status: 400 })
  }

  const level = loginTypeLevel || '1'

  let encryptedTail
  try {
    encryptedTail = rsaEncrypt(digits.slice(6))
  } catch (err) {
    return NextResponse.json({ error: `암호화 실패: ${err.message}` }, { status: 500 })
  }

  const requestPayload = {
    organization: '0001',
    loginType: loginType || '6',
    loginIdentity: encryptedTail,
    identityEncYn: 'Y',
    loginBirthDate: digits.slice(0, 6), // 이 상품만 필드명이 loginBirthDate
    userName,
    loginTypeLevel: level,
    ...(level === '5' ? { telecom: telecom || '0' } : {}),
    phoneNo: phoneNo.replace(/[^0-9]/g, ''),
    id: sharedId || `customer-${customerId || 'test'}-${Date.now()}`,
    isIdentityViewYN: '0',
    isAddrViewYn: '0',
    proofType: 'B0007',       // 대금수령용 아니면 기타
    submitTargets: '99',
    applicationType: '01',
    originDataYN: '0',
    originDataYN1: '1',
  }

  let result
  try {
    result = await callCodef(PRODUCT_PATH, requestPayload)
  } catch (err) {
    return NextResponse.json({ error: `CODEF 호출 실패: ${err.message}` }, { status: 502 })
  }

  if (needsTwoWay(result)) {
    const twoWay = result.data || {}
    const [row] = await sql`
      INSERT INTO codef_auth_sessions
        (customer_id, created_by, product, status, job_index, thread_index, jti, two_way_timestamp, request_payload, result_payload)
      VALUES
        (${customerId || null}, ${consultantId || null}, 'tax-payment-certificate', 'pending',
         ${twoWay.jobIndex ?? null}, ${twoWay.threadIndex ?? null}, ${twoWay.jti ?? null}, ${twoWay.twoWayTimestamp ?? null},
         ${JSON.stringify(requestPayload)}, ${JSON.stringify(result)})
      RETURNING id
    `
    return NextResponse.json({
      status: 'pending_2way',
      sessionId: row.id,
      message: `${level === '1' ? '카카오톡' : '인증 앱'}에서 인증을 승인한 뒤 확인 버튼을 눌러주세요. (제한시간 약 4분 30초)`,
      raw: result,
    })
  }

  return NextResponse.json({ status: 'done', result })
}
