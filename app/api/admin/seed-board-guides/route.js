// app/api/admin/seed-board-guides/route.js
// 학습센터(게시판)에 "기관별 특징·준비서류·발급처" 안내글을 등록(관리자 전용, 여러 번 눌러도 안전 — 같은 제목이 있으면 건너뜀).
import { sql } from '@/lib/db'
import { NextResponse } from 'next/server'
import { SEED_FUNDS } from '@/lib/policyFundsSeed'
import { INSTITUTIONS, FUND_CARDS, DOC_SOURCES, COMMON_RULES, ASOF } from '@/lib/guideContent'

export const dynamic = 'force-dynamic'

const byKey = Object.fromEntries(SEED_FUNDS.map((f) => [f.key, f]))
const FOOT = `\n\n※ ${ASOF} 일반 안내입니다. 공고·요건·한도는 수시로 바뀌므로 신청 전 해당 기관의 최신 공고를 확인하세요.`

function institutionPost(inst) {
  const lines = []
  lines.push(`■ 어떤 곳인가\n${inst.feature}`)
  lines.push(`■ 대상\n${inst.who}`)
  lines.push(`■ 접수 방법\n${inst.how}`)
  lines.push(`■ 꼭 확인할 것\n${inst.caution.map((c) => `• ${c}`).join('\n')}`)
  if (inst.funds.length > 1 || FUND_CARDS[inst.funds[0]]) {
    lines.push(`■ 자금 목록\n${inst.funds.map((k) => `• ${byKey[k].name} — 한도: ${FUND_CARDS[k].limit} / 대상: ${FUND_CARDS[k].target}`).join('\n')}`)
  }
  lines.push(`■ 공통 준비서류 체크리스트\n${inst.docs.map((d) => `☐ ${d}`).join('\n')}`)
  const extra = new Map()
  for (const k of inst.funds) {
    for (const d of byKey[k].required_docs || []) {
      if (/자동 연계|데이터 자동/.test(d)) continue
      if (!extra.has(d)) extra.set(d, [])
      extra.get(d).push(byKey[k].name.replace('중진공 ', ''))
    }
  }
  lines.push(`■ 자금별 필요서류\n${[...extra.entries()].map(([d, ns]) => `• ${d} — ${ns.length > 3 ? ns.slice(0, 3).join(', ') + ` 외 ${ns.length - 3}개` : ns.join(', ')}`).join('\n')}`)
  lines.push('■ 서류 발급처\n각 서류를 어디서 발급받는지는 "[기관별 서류 가이드] 서류 발급처 한눈에 보기" 글을 참고하세요.')
  return lines.join('\n\n') + FOOT
}

function buildPosts() {
  const posts = INSTITUTIONS.map((inst) => ({
    title: `[기관별 서류 가이드] ${inst.name} — 특징·준비서류`,
    content: institutionPost(inst),
  }))
  posts.push({
    title: '[기관별 서류 가이드] 서류 발급처 한눈에 보기 + 기관 조합 규칙',
    content:
      `■ 서류 발급처\n${DOC_SOURCES.map(([d, w, m]) => `• ${d}\n   발급처: ${w}\n   메모: ${m}`).join('\n')}` +
      `\n\n■ 기관 조합·공통 규칙\n${COMMON_RULES.map(([t, c]) => `• ${t}\n   ${c}`).join('\n')}` + FOOT,
  })
  return posts
}

export async function POST(request) {
  if (request.headers.get('x-consultant-role') !== 'admin') {
    return NextResponse.json({ error: '관리자만 실행할 수 있습니다.' }, { status: 403 })
  }
  const username = request.headers.get('x-consultant-id')
  const body = await request.json().catch(() => ({}))
  const authorName = body.authorName || '문수환'
  try {
    let created = 0
    let skipped = 0
    for (const p of buildPosts()) {
      const [exists] = await sql`SELECT id FROM board_posts WHERE title = ${p.title}`
      if (exists) { skipped++; continue }
      await sql`
        INSERT INTO board_posts (author_username, author_name, author_role, title, content)
        VALUES (${username}, ${authorName}, 'admin', ${p.title}, ${p.content})
      `
      created++
    }
    return NextResponse.json({ ok: true, created, skipped })
  } catch (err) {
    console.error('게시판 가이드 등록 실패:', err)
    return NextResponse.json({ error: `실패: ${err.message}` }, { status: 500 })
  }
}
