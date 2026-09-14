// app/api/cron/announcement-alerts/route.js
// 공고 자동 알림 — 기업마당(bizinfo.go.kr) 새 공고를 고객 사업장 소재지·업종과 대충 매칭해서
// "OO 지자체에서 [공고명] 공고가 떴습니다" 식으로 완전자동 발송. 개인화된 자격 판단이 아니라
// 공개된 사실 안내라 사람이 매 건 확인 안 하고 나감(구DB 재검토=customerRecheckStore.js와는 다른 결).
// Vercel Cron(vercel.json)으로 주기 실행. 수동으로도 호출 가능(관리자 테스트용).

import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { sql } from '@/lib/db'
import { filterUnseen, markSeen } from '@/lib/announcementAlertStore'
import { sendAlimtalk, isKakaoSendConfigured } from '@/lib/kakaoSend'
import { logNotification } from '@/lib/customerRecheckStore'

const REGION_KEYWORDS = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주']
const POLICY_KEYWORDS = ['지원금', '지원사업', '보조금', '융자', '자금', '바우처'] // 순수 안내성 공고 위주로 필터(교육·행사 공지 등 제외)

function uniqueKey(item) {
  // bizinfo 응답에 안정적인 ID 필드가 있으면 그걸 쓰고, 없으면 제목+기관+기간으로 지문을 만들어 중복 방지.
  const explicit = item.pblancId || item.id
  if (explicit) return String(explicit)
  const fingerprint = `${item.pblancNm || ''}|${item.jrsdInsttNm || item.excInsttNm || ''}|${item.reqstBeginEndDe || ''}`
  return crypto.createHash('md5').update(fingerprint).digest('hex')
}

function extractRegion(item) {
  const text = `${item.pblancNm || ''} ${item.jrsdInsttNm || item.excInsttNm || ''}`
  return REGION_KEYWORDS.find((r) => text.includes(r)) || null
}

export async function GET(request) {
  // Vercel Cron이 보내는 요청인지 확인(선택) — CRON_SECRET 설정해두면 검증, 없으면 통과(수동 테스트 허용).
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  }

  try {
    const res = await fetch('https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do?crtfcKey=ra31hj&dataType=json&pageUnit=100&pageIndex=1')
    const data = await res.json()
    const allItems = data?.jsonArray || []
    const policyItems = allItems.filter((it) => POLICY_KEYWORDS.some((k) => (it.pblancNm || '').includes(k)))
    const newItems = await filterUnseen('bizinfo', policyItems, 'pblancId')

    const consented = await sql`
      SELECT c.id, c.owner_name, c.phone, c.industry, c.address, c.consultant_id, a.name AS consultant_name
      FROM customers c LEFT JOIN accounts a ON a.username = c.consultant_id
      WHERE c.marketing_consent = true AND c.phone IS NOT NULL
    `

    const summary = []
    for (const item of newItems) {
      const key = uniqueKey(item)
      const region = extractRegion(item)
      const title = item.pblancNm || '공고'

      const matched = consented.filter((c) => {
        const regionOk = region ? (c.address || '').includes(region) : true // 지역을 특정 못하면(전국 공고 등) 전체 대상으로 봄
        const industryOk = c.industry ? title.includes(c.industry) || !POLICY_KEYWORDS.some((k) => title === k) : true
        return regionOk // 업종 매칭은 공고 제목이 짧아 오탐이 많아서 일단 지역만으로 거르고, 업종 키워드는 향후 정교화
      })

      let sentCount = 0
      for (const c of matched) {
        const configured = await isKakaoSendConfigured(c.consultant_id)
        const consultantName = c.consultant_name || '담당자'
        const message = `${consultantName} 담당자입니다. ${region ? `${region} ` : ''}${title} 공고가 떴습니다.`
        if (!configured) {
          await logNotification({ customerId: c.id, channel: 'kakao', message, status: 'failed', error: '담당 컨설턴트 채널 미연동', sentBy: 'cron' })
          continue
        }
        try {
          await sendAlimtalk({
            consultantUsername: c.consultant_id,
            phone: c.phone,
            variables: { '#{담당자명}': consultantName, '#{고객명}': c.owner_name, '#{자금명}': title, '#{문의링크}': `${new URL(request.url).origin}/apply/${c.consultant_id}` },
          })
          await logNotification({ customerId: c.id, channel: 'kakao', message, status: 'sent', sentBy: 'cron' })
          sentCount++
        } catch (err) {
          await logNotification({ customerId: c.id, channel: 'kakao', message, status: 'failed', error: err.message, sentBy: 'cron' })
        }
      }

      await markSeen('bizinfo', key, title, matched.length, sentCount)
      summary.push({ title, region, matched: matched.length, sent: sentCount })
    }

    return NextResponse.json({ ok: true, processed: newItems.length, summary })
  } catch (err) {
    console.error('공고 자동 알림 실패:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
