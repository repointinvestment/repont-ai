// app/api/reports/summary/route.js
import { sql } from '@/lib/db'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const consultantId = request.headers.get('x-consultant-id')
  const role = request.headers.get('x-consultant-role')
  const scoped = role !== 'admin' && consultantId

  const customerFilter = scoped ? sql`WHERE c.consultant_id = ${consultantId}` : sql``

  // 이번 달 신규 상담 (최초 이력 기준)
  const [{ count: newThisMonth }] = await sql`
    SELECT COUNT(*)::int AS count
    FROM (
      SELECT c.id, MIN(h.changed_at) AS first_at
      FROM customers c
      JOIN customer_status_history h ON h.customer_id = c.id
      ${customerFilter}
      GROUP BY c.id
    ) t
    WHERE date_trunc('month', t.first_at) = date_trunc('month', NOW())
  `

  // 이번 달 완료 전환 건수
  const [{ count: completedThisMonth }] = await sql`
    SELECT COUNT(*)::int AS count
    FROM customer_status_history h
    JOIN customers c ON c.id = h.customer_id
    ${customerFilter}
    WHERE h.status = '완료' AND date_trunc('month', h.changed_at) = date_trunc('month', NOW())
  `

  // 현재 단계별 분포
  const stageRows = scoped
    ? await sql`SELECT status, COUNT(*)::int AS count FROM customers WHERE consultant_id = ${consultantId} GROUP BY status`
    : await sql`SELECT status, COUNT(*)::int AS count FROM customers GROUP BY status`

  const stageBreakdown = { '상담중': 0, '서류준비': 0, '심사중': 0, '완료': 0 }
  for (const row of stageRows) {
    const stage = stageBreakdown.hasOwnProperty(row.status) ? row.status : '상담중'
    stageBreakdown[stage] += row.count
  }

  return NextResponse.json({ newThisMonth, completedThisMonth, stageBreakdown })
}
