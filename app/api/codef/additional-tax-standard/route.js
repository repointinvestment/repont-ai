// app/api/codef/additional-tax-standard/route.js
// CODEF "부가세과세표준증명 API" 1차 요청 — 회원 간편인증(loginType=5)으로 진행.
// 사업자등록증명과 달리 비회원 간편인증(6)을 지원하지 않음 — 고객이 홈택스 회원이어야 발급 가능.
// 나머지 흐름(추가인증, PDF 저장 등)은 사업자등록증명과 동일.

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { callCodef, rsaEncrypt, needsTwoWay, PRODUCTS } from '@/lib/codef'

const PRODUCT_KEY = 'additional-tax-standard'
const PRODUCT = PRODUCTS[PRODUCT_KEY]

// 과세기간 미지정 시 기본값: 가장 최근에 신고기한이 지난 부가세 과세기간을 자동 계산.
// (1기 신고기한 7/25, 2기 신고기한 다음해 1/25 — 넉넉히 한 달 여유를 두고 판단)
function defaultVatPeriod() {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1 // 1~12
  if (m >= 8) {
    // 8월 이후 — 올해 1기(1~6월)는 이미 신고기한 지남
    return { startDate: `${y}01`, endDate: `${y}06` }
  }
  // 1~7월 — 작년 2기(7~12월)가 가장 최근 완료된 기간
  return { startDate: `${y - 1}07`, endDate: `${y - 1}12` }
}

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
    startDate,
    endDate,
  } = body

  if (!userName || !residentNo || !phoneNo) {
    return NextResponse.json({ error: '이름, 주민등록번호, 휴대폰번호는 필수입니다.' }, { status: 400 })
  }

  const digits = residentNo.replace(/[^0-9]/g, '')
  if (digits.length !== 13) {
    return NextResponse.json({ error: '주민등록번호는 숫자 13자리여야 합니다.' }, { status: 400 })
  }

  const level = loginTypeLevel || '1'
  const period = startDate && endDate ? { startDate, endDate } : defaultVatPeriod()

  let encryptedTail
  try {
    encryptedTail = rsaEncrypt(digits.slice(6))
  } catch (err) {
    return NextResponse.json({ error: `암호화 실패: ${err.message}` }, { status: 500 })
  }

  const requestPayload = {
    organization: '0001',
    loginType: PRODUCT.loginType, // '5'
    loginIdentity: encryptedTail,
    identityEncYn: 'Y',
    birthDate: digits.slice(0, 6),
    userName,
    loginTypeLevel: level,
    ...(level === '5' ? { telecom: telecom || '0' } : {}),
    phoneNo: phoneNo.replace(/[^0-9]/g, ''),
    id: `customer-${customerId || 'test'}-${Date.now()}`,
    startDate: period.startDate,
    endDate: period.endDate,
    usePurposes: '02',
    submitTargets: '99',
    isIdentityViewYN: '0',
    originDataYN: '0',
    originDataYN1: '1',
    applicationType: '01',
  }

  let result
  try {
    result = await callCodef(PRODUCT.path, requestPayload)
  } catch (err) {
    return NextResponse.json({ error: `CODEF 호출 실패: ${err.message}` }, { status: 502 })
  }

  if (needsTwoWay(result)) {
    const twoWay = result.data || {}
    const [row] = await sql`
      INSERT INTO codef_auth_sessions
        (customer_id, created_by, product, status, job_index, thread_index, jti, two_way_timestamp, request_payload, result_payload)
      VALUES
        (${customerId || null}, ${consultantId || null}, ${PRODUCT_KEY}, 'pending',
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
