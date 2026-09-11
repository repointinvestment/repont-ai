// app/api/customers/recheck/route.js
// 구DB 관리시스템 — 저장된 고객 전체(완료·부결 포함)를 다시 판정해서 새로 뜨는 자금이 있으면 반환.
// 관리자는 전체, 컨설턴트는 자기 고객만.

import { NextResponse } from 'next/server'
import { recheckAll } from '@/lib/customerRecheckStore'
import { listFunds, listCommonRules } from '@/lib/policyFundsStore'

export async function POST(request) {
  const username = request.headers.get('x-consultant-id')
  const role = request.headers.get('x-consultant-role')
  if (!username) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  try {
    const [funds, rules] = await Promise.all([listFunds({ activeOnly: true }), listCommonRules()])
    const fundsByKey = {}
    for (const f of funds) fundsByKey[f.key] = f
    const rulesByKey = {}
    for (const r of rules) rulesByKey[r.key] = r

    const results = await recheckAll({ consultantUsername: role === 'admin' ? null : username, fundsByKey, rulesByKey })
    return NextResponse.json({ results })
  } catch (err) {
    console.error('구DB 재검토 실패:', err)
    return NextResponse.json({ results: [], error: err.message })
  }
}
