// app/api/customers/[id]/status-history/route.js
import { sql } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request, { params }) {
  const { id } = params
  const rows = await sql`
    SELECT status, changed_at
    FROM customer_status_history
    WHERE customer_id = ${id}
    ORDER BY changed_at ASC
  `
  return NextResponse.json({ history: rows })
}
