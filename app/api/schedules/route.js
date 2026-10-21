// app/api/schedules/route.js
// 소진공·중진공 등 "공고가 미리 안 뜨는" 자금의 접수일정 — 관리자가 입력하면 모든 컨설턴트 캘린더에 표시.
import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function ensure() {
  await sql`
    CREATE TABLE IF NOT EXISTS custom_schedules (
      id SERIAL PRIMARY KEY,
      org TEXT NOT NULL,
      title TEXT NOT NULL,
      start_date DATE,
      end_date DATE,
      note TEXT,
      url TEXT,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
}

export async function GET(request) {
  if (!request.headers.get('x-consultant-id')) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  await ensure()
  const rows = await sql`
    SELECT id, org, title, start_date::text AS start_date, end_date::text AS end_date, note, url
    FROM custom_schedules
    WHERE end_date IS NULL OR end_date >= CURRENT_DATE - INTERVAL '60 days'
    ORDER BY end_date NULLS LAST, id DESC
  `
  return NextResponse.json({ schedules: rows })
}

export async function POST(request) {
  if (request.headers.get('x-consultant-role') !== 'admin') return NextResponse.json({ error: '관리자만 입력할 수 있습니다.' }, { status: 403 })
  await ensure()
  const b = await request.json().catch(() => ({}))
  const org = String(b.org || '').trim().slice(0, 30)
  const title = String(b.title || '').trim().slice(0, 120)
  if (!org || !title) return NextResponse.json({ error: '기관과 자금명을 입력해주세요.' }, { status: 400 })
  const date = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? v : null)
  const url = /^https?:\/\//.test(String(b.url || '')) ? String(b.url).slice(0, 500) : null
  await sql`
    INSERT INTO custom_schedules (org, title, start_date, end_date, note, url, created_by)
    VALUES (${org}, ${title}, ${date(b.startDate)}, ${date(b.endDate)}, ${String(b.note || '').slice(0, 300) || null}, ${url}, ${request.headers.get('x-consultant-id')})
  `
  return NextResponse.json({ ok: true })
}

export async function DELETE(request) {
  if (request.headers.get('x-consultant-role') !== 'admin') return NextResponse.json({ error: '관리자만 삭제할 수 있습니다.' }, { status: 403 })
  await ensure()
  const id = Number(new URL(request.url).searchParams.get('id'))
  if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 })
  await sql`DELETE FROM custom_schedules WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
