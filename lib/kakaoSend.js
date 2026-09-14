// lib/kakaoSend.js
// 카카오 알림톡 발송 — 회사(리포인트파트너스) 명의 솔라피 계정(API키·시크릿·템플릿·발신번호)을
// 전체가 공유해서 쓰고, 컨설턴트별로 다른 건 그 사람 소유 카카오 채널의 프로필키(pfId)뿐.
// 그래서 메시지는 "회사 계정으로, 그 고객 담당 컨설턴트의 채널 이름으로" 나감.

import crypto from 'crypto'
import { getCompanyConfigForSending, isCompanyConfigured } from '@/lib/companyMessagingConfig'
import { getChannel, isChannelLinked } from '@/lib/consultantChannelStore'

function buildAuthHeader(apiKey, apiSecret) {
  const date = new Date().toISOString()
  const salt = crypto.randomBytes(16).toString('hex')
  const signature = crypto.createHmac('sha256', apiSecret).update(date + salt).digest('hex')
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`
}

// 이 컨설턴트한테 실제로 보낼 수 있는 상태인지(회사 계정 설정 + 본인 채널 연동) 확인.
export async function isKakaoSendConfigured(consultantUsername) {
  const [companyOk, channelOk] = await Promise.all([isCompanyConfigured(), isChannelLinked(consultantUsername)])
  return companyOk && channelOk
}

// consultantUsername: 그 고객 담당 컨설턴트(=채널 소유자). variables: 템플릿 안 {#고객명} 같은 치환 변수.
export async function sendAlimtalk({ consultantUsername, phone, variables }) {
  const [company, channel] = await Promise.all([getCompanyConfigForSending(), getChannel(consultantUsername)])
  if (!company || !company.apiKey || !company.apiSecret || !company.templateId) {
    throw new Error('회사 솔라피 계정이 아직 설정되지 않았습니다. 관리자에게 문의하세요.')
  }
  if (!channel || !channel.sender_key || !channel.is_active) {
    throw new Error('담당 컨설턴트의 카카오 채널이 아직 연동되지 않았습니다.')
  }

  const auth = buildAuthHeader(company.apiKey, company.apiSecret)
  const res = await fetch('https://api.solapi.com/messages/v4/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth },
    body: JSON.stringify({
      message: {
        to: phone.replace(/[^0-9]/g, ''),
        from: company.senderPhone || '',
        kakaoOptions: {
          pfId: channel.sender_key,
          templateId: company.templateId,
          variables,
        },
      },
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.errorMessage || `발송 실패 (${res.status})`)
  return data
}
