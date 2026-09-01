// app/api/codef/localtax-payment-certificate/route.js
// CODEF "지방세 납세증명 조회 API" 1차 요청 — 정부24 기반, 회원/비회원 간편인증(loginType 5/6) 지원.
// 주의사항 세 가지:
//   1) 주민등록번호 필드명이 'identity' (다른 문서들은 'loginIdentity') — 안 맞추면
//      CODEF가 "사업자번호(주민등록번호)가 잘못되었습니다" 에러를 냄 (실제로 겪었던 버그).
//   2) loginType="6"(비회원 간편인증)은 CODEF 스펙상 다건요청(SSO 묶음)을 지원하지 않음 —
//      단독 조회는 6으로 그대로 가능하지만, 다른 문서와 묶을 땐 프론트(CodefDocumentIssuance)에서
//      전체 로그인 방식을 5(회원)로 강제 전환함.
//   3) 이 문서만 주소(도로명주소+상세주소)가 필수 — 지방세는 관할 지자체 기준이라 필요.
//      또한 필드명이 isIdentityViewYn(소문자 n)이고, 값 의미도 다른 문서들과 반대
//      ("0"=전체표기, "1"=일부표기/기본) — 다른 문서의 isIdentityViewYN과 헷갈리지 않도록 주의.
// 다건요청 팔로워로 쓰일 경우 응답이 몇 분간 지연될 수 있어 타임아웃을 넉넉히 잡아둠.

export const maxDuration = 300

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { callCodef, rsaEncrypt, needsTwoWay, PRODUCTS } from '@/lib/codef'
import { saveIssuedPdfs } from '@/lib/codefSave'

const PRODUCT_KEY = 'localtax-payment-certificate'
const PRODUCT = PRODUCTS[PRODUCT_KEY]

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
    address,      // 도로명주소 (필수)
    addrDetail,   // 상세주소 (동/호수 등, 선택)
  } = body

  if (!userName || !residentNo || !phoneNo) {
    return NextResponse.json({ error: '이름, 주민등록번호, 휴대폰번호는 필수입니다.' }, { status: 400 })
  }
  if (!address) {
    return NextResponse.json({ error: '지방세 납세증명서는 주소(도로명주소) 입력이 필수입니다.' }, { status: 400 })
  }
  if (!addrDetail) {
    return NextResponse.json({ error: '지방세 납세증명서는 상세주소(동/호수 등) 입력이 필수입니다.' }, { status: 400 })
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
    loginType: loginType || PRODUCT.loginType, // 기본 '6' (비회원 간편인증)
    identity: encryptedTail, // 이 상품만 필드명이 identity (다른 문서들은 loginIdentity)
    identityEncYn: 'Y',
    birthDate: digits.slice(0, 6),
    userName,
    loginTypeLevel: level,
    ...(level === '5' ? { telecom: telecom || '0' } : {}),
    phoneNo: phoneNo.replace(/[^0-9]/g, ''),
    id: sharedId || `customer-${customerId || 'test'}-${Date.now()}`,
    address,
    addrDetail: addrDetail || '',
    isIdentityViewYn: '1', // 일부표기(기본값) — 이 문서만 대문자 N이 아니라 소문자 n, 값 의미도 반대라 주의
    proofType: '99',       // 그밖의 목적
    originDataYN: '0',
    originDataYN1: '1',    // 원문(PDF, Base64) 받기
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

  const isSuccess = result?.result?.code === 'CF-00000'
  let savedFiles = []
  if (isSuccess && customerId) {
    savedFiles = await saveIssuedPdfs(customerId, result, consultantId, PRODUCT.fileLabel)
  }
  return NextResponse.json({ status: isSuccess ? 'done' : 'error', result, savedFiles })
}
