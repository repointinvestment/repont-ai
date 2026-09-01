// app/api/codef/business-registration/route.js
// CODEF "사업자등록 증명 API" 1차 요청 — 비회원 간편인증(loginType=6)으로 진행.
// 성공적으로 요청이 접수되면 CF-03002(continue2Way=true)가 내려오고,
// 사용자가 카카오톡 등에서 인증을 승인한 뒤 /confirm 라우트로 2차 확인을 보내야 실제 데이터가 내려옴.
// 다건요청(같은 sharedId)의 "팔로워"로 쓰일 경우, 리더가 승인될 때까지 CODEF가 이 요청의 응답을
// 몇 분간 붙잡고 있을 수 있어 타임아웃을 넉넉히 잡아둠.

export const maxDuration = 300

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { callCodef, rsaEncrypt, needsTwoWay } from '@/lib/codef'
import { saveIssuedPdfs } from '@/lib/codefSave'

const PRODUCT_PATH = '/v1/kr/public/nt/proof-issue/corporate-registration'

export async function POST(request) {
  const consultantId = request.headers.get('x-consultant-id')
  const body = await request.json().catch(() => ({}))
  const {
    customerId,
    userName,
    residentNo,        // 주민등록번호 13자리 (하이픈 있어도 됨)
    phoneNo,            // 인증 받을 휴대폰 번호 (- 없이)
    loginTypeLevel,     // 1:카카오톡(기본), 3:삼성패스, 5:통신사PASS, ... (문서 참고)
    telecom,            // loginTypeLevel="5" (PASS)일 때만 필요: 0:SKT,1:KT,2:LGU+
    sharedId,           // 여러 문서를 한 세션으로 묶어 받을 때 프론트에서 넘겨주는 공용 식별자
    loginType,          // 기본 '6'(비회원 간편인증). 회원전용 문서와 함께 일괄 발급할 땐 '5'로 통일해서 세션 공유 시도
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
    loginType: loginType || '6', // 기본: 비회원 간편인증
    loginIdentity: encryptedTail,
    identityEncYn: 'Y',
    birthDate: digits.slice(0, 6),
    userName,
    loginTypeLevel: level,
    ...(level === '5' ? { telecom: telecom || '0' } : {}),
    phoneNo: phoneNo.replace(/[^0-9]/g, ''),
    id: sharedId || `customer-${customerId || 'test'}-${Date.now()}`,
    usePurposes: '02',       // 수금용 — 실제 서류 제출처에 맞게 조정 가능
    submitTargets: '99',     // 기타
    isIdentityViewYN: '0',   // 주민번호 뒷자리 비공개
    originDataYN: '0',
    originDataYN1: '1',      // 원문(PDF, Base64) 받기
    applicationType: '01',   // 본인
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
        (${customerId || null}, ${consultantId || null}, 'corporate-registration', 'pending',
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

  // continue2Way 없이 바로 결과가 온 경우 (단건이거나, 다건요청 팔로워로 쓰여서 리더 승인과 함께 즉시 완료된 경우)
  const isSuccess = result?.result?.code === 'CF-00000'
  let savedFiles = []
  if (isSuccess && customerId) {
    savedFiles = await saveIssuedPdfs(customerId, result, consultantId, '사업자등록증명')
  }
  return NextResponse.json({ status: isSuccess ? 'done' : 'error', result, savedFiles })
}
