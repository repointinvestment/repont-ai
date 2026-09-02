// app/api/announcements/match/route.js
// 공고 알림 (로드맵 6번). 소진공처럼 재신청 제한기간은 없고 "공고가 떠야" 재도전 가능한 부결 건들을
// 기업마당(bizinfo) 실시간 공고와 대조해서, 관련 기관의 새 공고가 있으면 알려줌.
// 정교한 자금별 매칭은 아직 아님 — 기관명 키워드로 1차 매칭(소진공/중진공/신용보증재단 등),
// 정확한 자금 일치 여부는 컨설턴트가 공고 링크를 직접 확인해야 함.

import { NextResponse } from 'next/server'
import { listAwaitingAnnouncement } from '@/lib/applicationsStore'

const POLICY_KEYWORDS = ['이차보전', '자금', '보증', '육성', '융자']
const INSTITUTION_KEYWORDS = {
  '소상공인시장진흥공단': ['소상공인시장진흥공단', '소진공'],
  '중소벤처기업진흥공단': ['중소벤처기업진흥공단', '중진공'],
  '지역신용보증재단': ['신용보증재단', '지역신보'],
  '신용보증기금': ['신용보증기금'],
  '기술보증기금': ['기술보증기금'],
}

function guessInstitution(text) {
  for (const [inst, kws] of Object.entries(INSTITUTION_KEYWORDS)) {
    if (kws.some((k) => text.includes(k))) return inst
  }
  return null
}

export async function GET() {
  const waiting = await listAwaitingAnnouncement()
  if (waiting.length === 0) return NextResponse.json({ matches: [] })

  let listings = []
  try {
    const res = await fetch('https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do?crtfcKey=ra31hj&dataType=json&pageUnit=100&pageIndex=1&hashtags=' + encodeURIComponent('금융'))
    const data = await res.json()
    listings = (data?.jsonArray || []).filter((item) => {
      const title = item.pblancNm || ''
      return POLICY_KEYWORDS.some((k) => title.includes(k))
    })
  } catch (e) {
    return NextResponse.json({ matches: [], error: '공고 조회 실패' })
  }

  // 공고를 기관별로 묶어서, 대기 중인 건의 institution과 대조
  const listingsByInstitution = {}
  for (const item of listings) {
    const text = `${item.pblancNm || ''} ${item.jrsdInsttNm || ''} ${item.excInsttNm || ''}`
    const inst = guessInstitution(text)
    if (!inst) continue
    if (!listingsByInstitution[inst]) listingsByInstitution[inst] = []
    listingsByInstitution[inst].push({ title: item.pblancNm, url: item.pblancUrl || item.detailUrl || null, period: item.reqstBeginEndDe || null })
  }

  const matches = waiting
    .map((a) => {
      const cands = listingsByInstitution[a.institution] || []
      return cands.length > 0 ? { applicationId: a.id, customerId: a.customer_id, ownerName: a.owner_name, businessName: a.business_name, fundName: a.fund_name, institution: a.institution, announcements: cands.slice(0, 3) } : null
    })
    .filter(Boolean)

  return NextResponse.json({ matches })
}
