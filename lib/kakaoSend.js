// lib/kakaoSend.js
// 카카오 알림톡 발송 — 솔라피(solapi.com) API 사용. 컨설턴트별로 자기 계정을 연결해서 쓰는 구조라
// 회사 전체가 공유하는 키가 아니라 lib/consultantMessagingStore.js에서 그 컨설턴트의 키를 가져와 씀.
// 컨설턴트가 /settings/kakao 화면에서 아직 연결을 안 했으면 발송을 시도하지 않고 명확한 에러를 던짐
// (오발송 방지 — "설정이 안 되어 있습니다"라고만 뜸).

import crypto from 'crypto'
import { getConfigForSending, isConfigured } from '@/lib/consultantMessagingStore'

function buildAuthHeader(apiKey, apiSecret) {
  const date = new Date().toISOString()
  const salt = crypto.randomBytes(16).toString('hex')
  const signature = crypto.createHmac('sha256', apiSecret).update(date + salt).digest('hex')
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`
}

export async function isKakaoSendConfigured(consultantUsername) {
  return isConfigured(consultantUsername)
}

// consultantUsername: 이 메시지를 보내는(=그 고객 담당) 컨설턴트. 그 사람 소유 채널/템플릿으로 나감.
// variables: 템플릿 안 {#고객명}, {#자금명} 같은 치환 변수. 템플릿 승인 시 확정된 변수명과 정확히 일치해야 함.
export async function sendAlimtalk({ consultantUsername, phone, variables }) {
  const config = await getConfigForSending(consultantUsername)
  if (!config || !config.apiKey || !config.apiSecret || !config.senderKey || !config.templateId) {
    throw new Error('카카오 알림 발송이 아직 연결되지 않았습니다. "카카오 알림 설정"에서 솔라피 계정을 연결해주세요.')
  }

  const auth = buildAuthHeader(config.apiKey, config.apiSecret)
  const res = await fetch('https://api.solapi.com/messages/v4/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth },
    body: JSON.stringify({
      message: {
        to: phone.replace(/[^0-9]/g, ''),
        from: config.senderPhone || '',
        kakaoOptions: {
          pfId: config.senderKey,
          templateId: config.templateId,
          variables,
        },
      },
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.errorMessage || `발송 실패 (${res.status})`)
  return data
}
