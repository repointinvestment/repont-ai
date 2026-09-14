// app/api/admin/notification-stats/route.js
// 관리자 전용 — 머니콕(카카오 알림) 발송 현황 통계. 컨설턴트별/전체 발송량·성공률, 최근 로그.
// notification_log는 회사 공용 솔라피 계정으로 나가는 전체 발송이 다 쌓이는 곳이라, 여기서만
// 전체를 조회할 수 있음(컨설턴트는 자기 고객 것만 보게 될 예정 — 이번엔 관리자 화면만 우선 구축).

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET(request) {
  if (request.headers.get('x-consultant-role') !== 'admin') {
    return NextResponse.json({ error: '관리자만 조회할 수 있습니다.' }, { status: 403 })
  }

  const [totals] = await sql`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'sent') AS sent,
      COUNT(*) FILTER (WHERE status = 'failed') AS failed,
      COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) AS today,
      COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE)) AS this_month
    FROM notification_log
  `

  const byConsultant = await sql`
    SELECT
      c.consultant_id, a.name AS consultant_name,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE nl.status = 'sent') AS sent,
      COUNT(*) FILTER (WHERE nl.status = 'failed') AS failed,
      MAX(nl.created_at) AS last_sent_at
    FROM notification_log nl
    JOIN customers c ON c.id = nl.customer_id
    LEFT JOIN accounts a ON a.username = c.consultant_id
    GROUP BY c.consultant_id, a.name
    ORDER BY total DESC
  `

  const failureReasons = await sql`
    SELECT error, COUNT(*) AS count
    FROM notification_log
    WHERE status = 'failed' AND error IS NOT NULL
    GROUP BY error
    ORDER BY count DESC
    LIMIT 10
  `

  const recent = await sql`
    SELECT nl.id, nl.message, nl.status, nl.error, nl.created_at, nl.sent_by,
           c.owner_name, c.business_name, c.consultant_id, a.name AS consultant_name
    FROM notification_log nl
    JOIN customers c ON c.id = nl.customer_id
    LEFT JOIN accounts a ON a.username = c.consultant_id
    ORDER BY nl.created_at DESC
    LIMIT 50
  `

  return NextResponse.json({ totals, byConsultant, failureReasons, recent })
}
