// app/api/cron/announcement-alerts/route.js
// 공고 자동 알림 — 기업마당(bizinfo.go.kr) 새 공고를 고객 사업장 소재지(지역) + 업종과 매칭해서
// "OO 지역 [공고명] 공고가 떴습니다" 식으로 완전자동 발송. 개인화된 자격 판단이 아니라
// 공개된 사실 안내라 사람이 매 건 확인 안 하고 나감(구DB 재검토=customerRecheckStore.js와는 다른 결).
// 업종 매칭: 고객 업종은 CRM에 이미 텍스트로 저장된 데이터라("파일을 여는" 게 아니라 DB 필드 비교)
// 공고 hashtags/제목과 대조 가능 — 다만 hashtags가 특정 업종을 명시하지 않은 범용 공고면 굳이 거르지 않음
// (과도하게 걸러서 정작 받아야 할 사람이 놓치는 것보다, 조금 안 맞는 공고 한두 번 더 가는 게 안전).
// Vercel Cron(vercel.json)으로 주기 실행. 수동으로도 호출 가능(관리자 테스트용).

import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { sql } from '@/lib/db'
import { filterUnseen, markSeen } from '@/lib/announcementAlertStore'
import { sendCustomerAlert } from '@/lib/notificationSend'

const REGION_KEYWORDS = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주']
const POLICY_KEYWORDS = ['지원금', '지원사업', '보조금', '융자', '자금', '바우처'] // 순수 안내성 공고 위주로 필터(교육·행사 공지 등 제외)
const INDUSTRY_HINTS = ['제조', '건설', '운수', '농업', '수산업', '음식점', '요식', '도소매', '서비스업', '정보통신', 'IT', '숙박']

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

// CRM 업종 텍스트("음식점·카페 (요식업)", "도소매업" 등)에서 대조용 핵심 키워드만 뽑음.
function industryKeyword(industry) {
  if (!industry) return null
  const cleaned = industry.split('(')[0].split('·')[0].replace(/업$/, '').trim()
  return cleaned || null
}

function industryMatches(item, customerIndustry) {
  const hashtags = item.hashtags || ''
  const kw = industryKeyword(customerIndustry)
  if (!kw || !hashtags) return true // 정보 부족하면 걸러내지 않음(포함시킴)
  const mentionsAnyIndustry = INDUSTRY_HINTS.some((h) => hashtags.includes(h))
  if (!mentionsAnyIndustry) return true // 특정 업종 한정이 아닌 범용 공고면 통과
  return hashtags.includes(kw)
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

    const consented = await sql`SELECT * FROM customers WHERE marketing_consent = true AND phone IS NOT NULL`
    const siteOrigin = new URL(request.url).origin

    const summary = []
    for (const item of newItems) {
      const key = uniqueKey(item)
      const region = extractRegion(item)
      const title = item.pblancNm || '공고'

      const matched = consented.filter((c) => {
        const regionOk = region ? (c.address || '').includes(region) : true // 지역을 특정 못하면(전국 공고 등) 전체 대상으로 봄
        return regionOk && industryMatches(item, c.industry)
      })

      let sentCount = 0
      for (const c of matched) {
        const fundTitle = `${region ? `${region} ` : ''}${title}`
        const result = await sendCustomerAlert({ customer: c, fundName: fundTitle, siteOrigin, sentBy: 'cron' })
        if (result.ok) sentCount++
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
