// app/api/customers/[id]/files/route.js
// 파일은 Private Blob 저장소에 저장됩니다. blob_url(=pathname)만 DB에 저장하고,
// 실제 열람은 /api/customers/[id]/files/[fileId]/download 를 통해서만 가능합니다.
import { sql } from '@/lib/db'
import { put } from '@vercel/blob'
import { NextResponse } from 'next/server'

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.hancom.hwp',
  'application/x-hwp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/webp',
]

export async function GET(request, { params }) {
  const { id } = params
  const rows = await sql`
    SELECT id, file_name, blob_url, size_bytes, uploaded_by, created_at
    FROM customer_files
    WHERE customer_id = ${id}
    ORDER BY created_at DESC
  `
  return NextResponse.json({ files: rows })
}

export async function POST(request, { params }) {
  const { id } = params
  const uploadedBy = request.headers.get('x-consultant-id') || null

  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!file) {
      return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })
    }
    if (ALLOWED_TYPES.length > 0 && file.type && !ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: `허용되지 않는 파일 형식입니다. (${file.type || '알 수 없음'}) 문서·이미지 파일만 업로드 가능` }, { status: 400 })
    }

    const blob = await put(`customers/${id}/${Date.now()}-${file.name}`, file, {
      access: 'private',
    })

    const [row] = await sql`
      INSERT INTO customer_files (customer_id, file_name, blob_url, size_bytes, uploaded_by)
      VALUES (${id}, ${file.name}, ${blob.pathname}, ${file.size || null}, ${uploadedBy})
      RETURNING *
    `

    return NextResponse.json({ file: row })
  } catch (err) {
    console.error('파일 업로드 실패:', err)
    return NextResponse.json({ error: `업로드 실패: ${err.message || '알 수 없는 오류'}` }, { status: 500 })
  }
}
