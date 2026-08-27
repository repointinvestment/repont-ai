// app/api/board/posts/[id]/files/route.js
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
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png',
  'image/jpeg',
  'image/webp',
]

export async function POST(request, { params }) {
  const { id } = params

  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!file) {
      return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })
    }
    if (ALLOWED_TYPES.length > 0 && file.type && !ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: `허용되지 않는 파일 형식입니다. (${file.type || '알 수 없음'})` }, { status: 400 })
    }

    const blob = await put(`board/${id}/${Date.now()}-${file.name}`, file, {
      access: 'private',
    })

    const [row] = await sql`
      INSERT INTO board_post_files (post_id, file_name, blob_url, size_bytes)
      VALUES (${id}, ${file.name}, ${blob.pathname}, ${file.size || null})
      RETURNING *
    `

    return NextResponse.json({ file: row })
  } catch (err) {
    console.error('게시글 파일 업로드 실패:', err)
    return NextResponse.json({ error: `업로드 실패: ${err.message || '알 수 없는 오류'}` }, { status: 500 })
  }
}
