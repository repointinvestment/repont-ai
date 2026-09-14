// app/api/codef/tax-payment-certificate/route.js
// CODEF "납세증명서 API" 1차 요청. 사업자등록증명과 마찬가지로 비회원 간편인증(loginType=6) 지원.
// 주의: 이 상품은 생년월일 필드명이 다른 문서들과 달리 'loginBirthDate' (다른 곳은 'birthDate').
// 다건요청 팔로워로 쓰일 경우 응답이 몇 분간 지연될 수 있어 타임아웃을 넉넉히 잡아둠.

export const maxDuration = 300

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { callCodef, rsaEncrypt, needsTwoWay } from '@/lib/codef'
import { saveIssuedPdfs } from '@/lib/codefSave'

const PRODUCT_PATH = '/v1/kr/public/nt/proof-issue/tax-cert-all'

export async function POST(request) {
  const consultantId = request.headers.get('x-consultant-id')
  const role = request.headers.get('x-consultant-role')
  if (!consultantId) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  const body = await request.json().catch(() => ({}))
  // customerId가 있으면(테스트용 호출이 아니면) 그 컨설턴트 본인 담당 고객인지 확인 —
  // 안 그러면 남의 customerId를 끼워 넣어서 CODEF 요청 결과가 엉뚱한 고객 파일함에 저장될 수 있음.
  if (body.customerId) {
    const [owner] = await sql`SELECT consultant_id FROM customers WHERE id = ${body.customerId}`
    if (!owner) return NextResponse.json({ error: '고객을 찾을 수 없습니다.' }, { status: 404 })
    if (role !== 'admin' && String(owner.consultant_id) !== String(consultantId)) {
      return NextResponse.json({ error: '본인이 담당하는 고객만 서류를 발급받을 수 있습니다.' }, { status: 403 })
    }
  }
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

  const isSuccess = result?.result?.code === 'CF-00000'
  let savedFiles = []
  if (isSuccess && customerId) {
    savedFiles = await saveIssuedPdfs(customerId, result, consultantId, '납세증명서')
  }
  return NextResponse.json({ status: isSuccess ? 'done' : 'error', result, savedFiles })
}
