// lib/notificationSend.js
// 카카오 알림 발송의 공통 로직 — 수동 발송(고객 상세/구DB 위젯)·자동 발송(공고 cron)·재발송이
// 전부 이 함수 하나를 거치게 해서 메시지 조립·로그 기록 방식이 갈라지지 않게 함.

import { sql } from '@/lib/db'
import { sendAlimtalk, isKakaoSendConfigured } from '@/lib/kakaoSend'
import { logNotification, getOrCreatePublicToken } from '@/lib/customerRecheckStore'

// customer: customers 테이블 row (최소 id, owner_name, phone, consultant_id 필요)
// fundName: 알림에 표시할 소식 제목(공고명·자금명·컨설턴트가 만든 자료 제목 등)
// variables: 이미 만들어진 변수셋이 있으면(재발송) 그대로 씀 — 없으면 여기서 새로 조립
export async function sendCustomerAlert({ customer, fundName, variables, siteOrigin, sentBy }) {
  if (!customer.marketing_consent) {
    return { ok: false, status: 400, error: '이 고객은 정책자금 안내 수신에 동의하지 않았습니다.' }
  }
  // 카카오 알림톡은 "수신자 본인의 액션"이 있어야만 승인되는 정보성 메시지라, 단순 수신동의만으로는
  // 부족함(실제로 반려된 사례 있음) — 고객이 /join/토큰 페이지에서 직접 "신청하기"를 눌러야만
  // (alert_subscribed_at) 이 유형의 알림을 보낼 수 있게 막아둠. "신청안내 문자발송" 메뉴로 유도.
  if (!customer.alert_subscribed_at) {
    return { ok: false, status: 400, error: '이 고객은 아직 정책자금 소식 알림을 신청하지 않았습니다. "신청안내 문자발송" 메뉴에서 먼저 신청 안내를 보내주세요.' }
  }
  if (!customer.phone) {
    return { ok: false, status: 400, error: '연락처가 등록되어 있지 않습니다.' }
  }

  const sendingConsultant = customer.consultant_id || sentBy
  const [consultantAccount] = await sql`SELECT name, display_name FROM accounts WHERE username = ${sendingConsultant}`
  const consultantName = consultantAccount?.display_name || consultantAccount?.name || '담당자'
  // 링크에 개인 토큰을 붙여서, 고객이 눌렀을 때 이름·매출·업력 등을 다시 입력할 필요 없이 저장된
  // 정보로 바로 결과를 보여줌(재발송이라 폼 다시 입력하는 걸 귀찮아함 — 신규 리드 유입용 일반
  // /apply/[아이디] 링크와는 다른 동작).
  const token = await getOrCreatePublicToken(customer.id)
  const inquiryLink = `${siteOrigin}/apply/${sendingConsultant}?t=${token}`

  const finalVariables = variables || {
    '#{담당자명}': consultantName, '#{고객명}': customer.owner_name, '#{소식명}': fundName, '#{자료확인하기}': inquiryLink,
  }
  // 실제 발송되는 알림톡 템플릿(솔라피에 등록·승인된 것) 문구:
  // "안녕하세요 #{고객명} 대표님, #{담당자명}입니다. #{소식명} 관련해서 정보 전달드립니다 ^^
  //  아래 링크를 눌러 자료 확인해보시고, 상담이 필요하시면 자료 안의 '문의하기' 버튼을 눌러주세요.
  //  확인하는 대로 빠르게 연락드리겠습니다. #{자료확인하기}
  //  이용이 어려우신 경우에는 카톡으로 답장 주셔도 됩니다 :)"
  // 여기 message는 우리 쪽 발송 로그(고객 카톡 발송 내역·머니콕 발송 현황)에만 쓰는 표시용 텍스트라
  // 실제 템플릿과 완전히 같을 필요는 없지만, 헷갈리지 않게 같은 문구로 맞춰둠.
  const message = `안녕하세요 ${finalVariables['#{고객명}'] || customer.owner_name} 대표님, ${finalVariables['#{담당자명}'] || consultantName}입니다. ${fundName} 관련해서 정보 전달드립니다. 자료 확인: ${finalVariables['#{자료확인하기}'] || inquiryLink}`

  if (!(await isKakaoSendConfigured(sendingConsultant))) {
    const log = await logNotification({ customerId: customer.id, channel: 'kakao', message, variables: finalVariables, fundName, status: 'failed', error: '발송 미연결(카카오 알림 설정 필요)', sentBy })
    return { ok: false, status: 501, error: '카카오 알림 발송이 아직 연결되지 않았습니다. "카카오 알림 설정" 메뉴에서 채널을 연결해주세요.', log }
  }

  try {
    // 템플릿 변수명은 실제 솔라피에 승인된 알림톡 템플릿의 변수명과 정확히 일치해야 함(심사 시 확정).
    // #{문의링크}는 그 고객 담당 컨설턴트의 /apply/[아이디] 자가진단 공개 링크 — 고객이 "문의하기"를
    // 누르면 그 컨설턴트의 자금비서 CRM에 리드로 자동 등록됨(이미 구현된 흐름 재사용).
    await sendAlimtalk({ consultantUsername: sendingConsultant, phone: customer.phone, variables: finalVariables })
    const log = await logNotification({ customerId: customer.id, channel: 'kakao', message, variables: finalVariables, fundName, status: 'sent', sentBy })
    return { ok: true, log }
  } catch (err) {
    const log = await logNotification({ customerId: customer.id, channel: 'kakao', message, variables: finalVariables, fundName, status: 'failed', error: err.message, sentBy })
    return { ok: false, status: 500, error: err.message, log }
  }
}
