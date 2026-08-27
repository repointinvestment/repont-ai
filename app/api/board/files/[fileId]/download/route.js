// app/api/board/files/[fileId]/download/route.js
import { sql } from '@/lib/db'
import { get } from '@vercel/blob'
import { NextResponse } from 'next/server'

export async function GET(request, { params }) {
  const { fileId } = params
  const username = request.headers.get('x-consultant-id')

  if (!username) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const rows = await sql`SELECT file_name, blob_url FROM board_post_files WHERE id = ${fileId}`
  if (rows.length === 0) {
    return NextResponse.json({ error: '파일을 찾을 수 없습니다.' }, { status: 404 })
  }
  const file = rows[0]

  const result = await get(file.blob_url, { access: 'private' })
  if (result?.statusCode !== 200) {
    return new NextResponse('Not found', { status: 404 })
  }

  return new NextResponse(result.stream, {
    headers: {
      'Content-Type': result.blob.contentType || 'application/octet-stream',
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.file_name)}`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-cache',
    },
  })
}
