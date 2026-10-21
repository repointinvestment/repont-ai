// app/api/cron/gov-support-match/route.js
// 보조금24(행정안전부 공공서비스) 등 정부 지원사업을 받아와서, 각 컨설턴트가 등록한 '내 고객' 중
// 신청 대상일 가능성이 있는 사람을 찾아 컨설턴트 본인 휴대폰으로 문자 알림 → 컨설턴트가 고객에게 직접 연락.
// 고객에게 자동 발송하지 않는다(개인화된 자격 판단은 사람이 확인 후 연락). 컨설턴트 본인에게 가는 업무 알림이라 수신동의 이슈 없음.
//
// 필요 환경변수: DATA_GO_KR_KEY (공공데이터포털 일반 인증키(Decoding)). 없으면 아무것도 하지 않고 안내만 반환.
// 수동 테스트: GET /api/cron/gov-support-match?dry=1 (문자 발송/기록 없이 매칭 결과만 확인)

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { filterUnseen, markSeen } from '@/lib/announcementAlertStore'
import { sendSMS } from '@/lib/kakaoSend'

const REGIONS = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주']
const SMALL_BIZ_WORDS = ['소상공인', '자영업', '소기업', '중소기업', '중소벤처', '사업자', '창업', '개인사업']

async function fetchGov24() {
  const key = process.env.DATA_GO_KR_KEY
  const url = `https://api.odcloud.kr/api/gov24/v3/serviceList?page=1&perPage=300&returnType=JSON&serviceKey=${encodeURIComponent(key)}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`보조금24 조회 실패 (${res.status})`)
  const data = await res.json()
  return (data?.data || []).map((r) => ({
    id: r['서비스ID'],
    title: r['서비스명'],
    target: `${r['지원대상'] || ''} ${r['사용자구분'] || ''} ${r['선정기준'] || ''}`,
    summary: r['서비스목적요약'] || r['지원내용'] || '',
    org: r['소관기관명'] || '',
    deadline: r['신청기한'] || '',
    url: r['상세조회URL'] || '',
  })).filter((r) => r.id && r.title)
}

function regionOf(item) {
  return REGIONS.find((g) => `${item.title} ${item.org}`.includes(g)) || null
}

function matchReason(item, c) {
  const text = `${item.title} ${item.target}`
  const reasons = []
  if (!SMALL_BIZ_WORDS.some((w) => text.includes(w))) return null // 사업자 대상 사업만
  reasons.push('사업자 대상')
  const region = regionOf(item)
  if (region) {
    if (!(c.address || '').includes(region)) return null
    reasons.push(`${region} 소재`)
  }
  if (/여성/.test(item.title) && !c.has_woman_biz_cert) return null
  if (/청년/.test(item.title)) return null // 나이 정보가 없어 자동 매칭 안 함(제외)
  if (/농업|농어|어업|축산|임업/.test(item.title) && !/농|어|축|임/.test(c.industry || '')) return null
  if (/에너지바우처|기초생활|차상위|복지/.test(item.title)) return null // 개인 복지성은 사업자 매칭 제외
  return reasons.join(' · ')
}

export async function GET(request) {
  const auth = request.headers.get('authorization')
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  }
  if (!process.env.DATA_GO_KR_KEY) {
    return NextResponse.json({ ok: false, error: 'DATA_GO_KR_KEY 환경변수가 없습니다. 공공데이터포털(data.go.kr)에서 "행정안전부_대한민국 공공서비스(혜택) 정보" 활용신청 후 인증키를 Vercel에 등록하세요.' })
  }
  const dry = new URL(request.url).searchParams.get('dry') === '1'

  try {
    await sql`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS alert_phone TEXT`
    const all = await fetchGov24()
    const fresh = dry ? all : await filterUnseen('gov24', all, 'id')

    const customers = await sql`SELECT c.*, a.alert_phone, a.name AS consultant_name FROM customers c
      JOIN accounts a ON a.username = c.consultant_id
      WHERE a.role IN ('consultant', 'admin') AND c.status NOT IN ('종료', '거절')`

    const byConsultant = new Map()
    const perItem = []
    for (const item of fresh) {
      let n = 0
      for (const c of customers) {
        const reason = matchReason(item, c)
        if (!reason) continue
        n++
        const list = byConsultant.get(c.consultant_id) || { phone: c.alert_phone, rows: [] }
        list.rows.push({ item, c, reason })
        byConsultant.set(c.consultant_id, list)
      }
      perItem.push({ title: item.title, matched: n })
      if (!dry) await markSeen('gov24', String(item.id), item.title, n, n)
    }

    let smsSent = 0
    const preview = []
    for (const [consultantId, { phone, rows }] of byConsultant) {
      // 사업 하나당 대상 고객을 묶어 한 통으로 정리(문자 폭탄 방지, 최대 4개 사업)
      const byItem = new Map()
      for (const r of rows) {
        const arr = byItem.get(r.item.id) || { item: r.item, names: [] }
        arr.names.push(r.c.owner_name || r.c.business_name || '고객')
        byItem.set(r.item.id, arr)
      }
      const parts = [...byItem.values()].slice(0, 4).map(({ item, names }) =>
        `▶${item.title}${item.deadline ? ` (~${item.deadline})` : ''}\n대상후보: ${names.slice(0, 6).join(', ')}${names.length > 6 ? ` 외 ${names.length - 6}명` : ''}`)
      const more = byItem.size > 4 ? `\n외 ${byItem.size - 4}건은 자금비서에서 확인` : ''
      const text = `[자금비서] 내 고객 중 새 지원사업 대상 후보가 있어요\n${parts.join('\n')}${more}\n※ 자격은 공고문으로 꼭 재확인하세요.`
      preview.push({ consultantId, hasPhone: !!phone, text })
      if (!dry && phone) {
        try { await sendSMS({ phone, message: text }); smsSent++ } catch (e) { console.error('문자 발송 실패', consultantId, e.message) }
      }
    }

    return NextResponse.json({ ok: true, dry, fetched: all.length, newItems: fresh.length, smsSent, perItem: perItem.filter((p) => p.matched).slice(0, 30), preview })
  } catch (err) {
    console.error('정부지원사업 매칭 실패:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
