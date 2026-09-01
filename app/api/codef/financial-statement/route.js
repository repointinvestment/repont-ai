// app/api/codef/financial-statement/route.js
// CODEF "재무제표 API" 1차 요청 — 회원/비회원 간편인증(loginType 5 또는 6) 모두 지원, 기본은 6(비회원).
// 다른 문서들과 달리 기간(startDate~endDate)이 아니라 단일 startDate 하나:
//   - 개인사업자: 귀속연도만 (yyyy) + proofType(40:사업소득) 필요
//   - 법인사업자: 사업연도종료연월 (yyyyMM), proofType 불필요
// 간편장부대상자이거나 업력이 짧아 국세청에 재무제표 자체가 없는 경우 CODEF가 에러로 응답함 —
// 이건 장애가 아니라 정상적인 "없음" 상태라 프론트(CodefDocumentIssuance)에서 안내 문구를 덧붙여 보여줌.
// 다건요청 팔로워로 쓰일 경우 응답이 몇 분간 지연될 수 있어 타임아웃을 넉넉히 잡아둠.

export const maxDuration = 300

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { callCodef, rsaEncrypt, needsTwoWay, PRODUCTS } from '@/lib/codef'
import { saveIssuedPdfs } from '@/lib/codefSave'

const PRODUCT_KEY = 'financial-statement'
const PRODUCT = PRODUCTS[PRODUCT_KEY]

// 종합소득세 신고기한(5/31, 성실신고확인대상자는 6/30)이 지나야 그 해 귀속 재무제표가 나옴 —
// 여유를 두고 7월 이후면 작년, 그 전이면 재작년을 기본 귀속연도로 삼음.
function defaultAttrYear() {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  return m >= 7 ? y - 1 : y - 2
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
    sharedId,
    loginType,
    businessType, // 'individual'(기본) | 'corporate' — 법인이면 사업연도종료월까지 필요
    attrYear,     // yyyy, 비우면 자동 계산
    attrMonth,    // 법인일 때만 사용, '01'~'12' (사업연도 종료월, 기본 12)
  } = body

  if (!userName || !residentNo || !phoneNo) {
    return NextResponse.json({ error: '이름, 주민등록번호, 휴대폰번호는 필수입니다.' }, { status: 400 })
  }

  const digits = residentNo.replace(/[^0-9]/g, '')
  if (digits.length !== 13) {
    return NextResponse.json({ error: '주민등록번호는 숫자 13자리여야 합니다.' }, { status: 400 })
  }

  const level = loginTypeLevel || '1'
  const isCorporate = businessType === 'corporate'
  const year = attrYear || String(defaultAttrYear())
  const startDate = isCorporate ? `${year}${String(attrMonth || '12').padStart(2, '0')}` : year

  let encryptedTail
  try {
    encryptedTail = rsaEncrypt(digits.slice(6))
  } catch (err) {
    return NextResponse.json({ error: `암호화 실패: ${err.message}` }, { status: 500 })
  }

  const requestPayload = {
    organization: '0001',
    loginType: loginType || PRODUCT.loginType, // 기본 '6' (비회원 간편인증)
    loginIdentity: encryptedTail,
    identityEncYn: 'Y',
    birthDate: digits.slice(0, 6),
    userName,
    loginTypeLevel: level,
    ...(level === '5' ? { telecom: telecom || '0' } : {}),
    phoneNo: phoneNo.replace(/[^0-9]/g, ''),
    id: sharedId || `customer-${customerId || 'test'}-${Date.now()}`,
    startDate,
    isIdentityViewYN: '0',
    usePurposes: '03',        // 관공서제출용
    submitTargets: '01',      // 금융기관 — 정책자금 심사 제출 목적
    ...(!isCorporate ? { proofType: '40' } : {}), // 개인사업자만 필요 — 40:사업소득
    applicationType: '01',    // 본인
    originDataYN: '0',
    originDataYN1: '1',       // 원문(PDF, Base64) 받기
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
