// app/api/business-plans/route.js
import { sql } from '@/lib/db'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const consultantId = request.headers.get('x-consultant-id')
  const role = request.headers.get('x-consultant-role')

  const rows = (role === 'admin' || !consultantId)
    ? await sql`
        SELECT bp.id, bp.customer_id, bp.fund_name, bp.content, bp.created_at,
               c.owner_name, c.business_name
        FROM business_plans bp
        JOIN customers c ON c.id = bp.customer_id
        ORDER BY bp.created_at DESC
      `
    : await sql`
        SELECT bp.id, bp.customer_id, bp.fund_name, bp.content, bp.created_at,
               c.owner_name, c.business_name
        FROM business_plans bp
        JOIN customers c ON c.id = bp.customer_id
        WHERE c.consultant_id = ${consultantId}
        ORDER BY bp.created_at DESC
      `

  return NextResponse.json({ plans: rows })
}
