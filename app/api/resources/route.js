// app/api/resources/route.js
// 자료실 — 문수환 대표가 컨설턴트들에게 공유하는 강의자료(PPT/PDF/엑셀/이미지) 다운로드 저장소.
// 학습센터 게시판(공지·질문)과는 성격이 달라서 별도로 둠 — 여기는 순수 파일 자료만, 글(텍스트 게시물) 없음.
// GET은 로그인한 누구나(컨설턴트 전원), POST(업로드)는 관리자만.

import { sql } from '@/lib/db'
import { put } from '@vercel/blob'
import { NextResponse } from 'next/server'

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/webp',
]

let schemaReady = false
async function ensureSchema() {
  if (schemaReady) return
  await sql`
    CREATE TABLE IF NOT EXISTS resource_files (
      id SERIAL PRIMARY KEY,
      file_name TEXT NOT NULL,
      blob_url TEXT NOT NULL,
      size_bytes INTEGER,
      description TEXT,
      uploaded_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`ALTER TABLE resource_files ADD COLUMN IF NOT EXISTS description TEXT`
  schemaReady = true
}

export async function GET() {
  await ensureSchema()
  const rows = await sql`SELECT id, file_name, blob_url, size_bytes, description, uploaded_by, created_at FROM resource_files ORDER BY created_at DESC`
  return NextResponse.json({ files: rows })
}

export async function POST(request) {
  await ensureSchema()
  if (request.headers.get('x-consultant-role') !== 'admin') {
    return NextResponse.json({ error: '관리자만 자료를 올릴 수 있습니다.' }, { status: 403 })
  }
  const uploadedBy = request.headers.get('x-consultant-id') || null

  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const description = formData.get('description') || null
    if (!file) return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })
    if (ALLOWED_TYPES.length > 0 && file.type && !ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: `허용되지 않는 파일 형식입니다. (${file.type || '알 수 없음'}) PPT·PDF·엑셀·이미지만 업로드 가능` }, { status: 400 })
    }

    const blob = await put(`resources/${Date.now()}-${file.name}`, file, { access: 'private' })

    const [row] = await sql`
      INSERT INTO resource_files (file_name, blob_url, size_bytes, description, uploaded_by)
      VALUES (${file.name}, ${blob.pathname}, ${file.size || null}, ${description}, ${uploadedBy})
      RETURNING *
    `
    return NextResponse.json({ file: row })
  } catch (err) {
    console.error('자료실 업로드 실패:', err)
    return NextResponse.json({ error: `업로드 실패: ${err.message || '알 수 없는 오류'}` }, { status: 500 })
  }
}
