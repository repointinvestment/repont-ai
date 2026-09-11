// lib/kakaoSend.js
// 카카오 알림톡 발송 — 솔라피(solapi.com) API 사용. 실제로 보내려면:
//   1. 카카오 비즈니스 채널 개설
//   2. 솔라피 가입 + 카카오 채널 연동 (SOLAPI_KAKAO_CHANNEL_ID 발급)
//   3. 알림톡 템플릿 등록·심사 승인 (SOLAPI_TEMPLATE_ID 발급) — 문구 바뀌면 재심사 필요
//   4. Vercel 환경변수에 SOLAPI_API_KEY / SOLAPI_API_SECRET / SOLAPI_SENDER_KEY / SOLAPI_TEMPLATE_ID 추가
// 위 환경변수가 없으면 발송을 시도하지 않고 명확한 에러를 던짐 — 설정 전까지는 버튼을 눌러도
// "발송 설정이 안 되어 있습니다"라고만 뜨고 실제로 카톡이 나가지 않음(오발송 방지).

import crypto from 'crypto'

function buildAuthHeader() {
  const apiKey = process.env.SOLAPI_API_KEY
  const apiSecret = process.env.SOLAPI_API_SECRET
  if (!apiKey || !apiSecret) return null
  const date = new Date().toISOString()
  const salt = crypto.randomBytes(16).toString('hex')
  const signature = crypto.createHmac('sha256', apiSecret).update(date + salt).digest('hex')
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`
}

export function isKakaoSendConfigured() {
  return !!(process.env.SOLAPI_API_KEY && process.env.SOLAPI_API_SECRET && process.env.SOLAPI_SENDER_KEY && process.env.SOLAPI_TEMPLATE_ID)
}

// variables: 템플릿 안 {#고객명}, {#자금명} 같은 치환 변수. 템플릿 승인 시 확정된 변수명과 정확히 일치해야 함.
export async function sendAlimtalk({ phone, variables }) {
  if (!isKakaoSendConfigured()) {
    throw new Error('카카오 알림톡 발송이 아직 설정되지 않았습니다. 솔라피 계약 후 SOLAPI_API_KEY 등 환경변수를 설정해주세요.')
  }
  const auth = buildAuthHeader()
  const res = await fetch('https://api.solapi.com/messages/v4/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth },
    body: JSON.stringify({
      message: {
        to: phone.replace(/[^0-9]/g, ''),
        from: process.env.SOLAPI_SENDER_PHONE || '',
        kakaoOptions: {
          pfId: process.env.SOLAPI_SENDER_KEY,
          templateId: process.env.SOLAPI_TEMPLATE_ID,
          variables,
        },
      },
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.errorMessage || `발송 실패 (${res.status})`)
  return data
}
