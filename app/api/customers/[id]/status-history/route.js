// app/api/customers/[id]/status-history/route.js
import { sql } from '@/lib/db'
import { requireCustomerOwnership } from '@/lib/authz'
import { NextResponse } from 'next/server'

export async function GET(request, { params }) {
  const { id } = params
  const check = await requireCustomerOwnership(Number(id), request)
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status })
  const rows = await sql`
    SELECT status, changed_at
    FROM customer_status_history
    WHERE customer_id = ${id}
    ORDER BY changed_at ASC
  `
  return NextResponse.json({ history: rows })
}
