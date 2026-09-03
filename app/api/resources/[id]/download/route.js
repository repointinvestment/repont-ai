// app/api/resources/[id]/download/route.js
// Private Blob 파일 스트리밍 — 로그인한 컨설턴트 전원 다운로드 가능(고객 파일과 달리 담당자 제한 없음).

import { sql } from '@/lib/db'
import { get } from '@vercel/blob'
import { NextResponse } from 'next/server'

export async function GET(request, { params }) {
  if (!request.headers.get('x-consultant-id')) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  const rows = await sql`SELECT file_name, blob_url FROM resource_files WHERE id = ${params.id}`
  if (rows.length === 0) return NextResponse.json({ error: '자료를 찾을 수 없습니다.' }, { status: 404 })
  const file = rows[0]

  const result = await get(file.blob_url, { access: 'private' })
  if (result?.statusCode !== 200) return new NextResponse('Not found', { status: 404 })

  return new NextResponse(result.stream, {
    headers: {
      'Content-Type': result.blob.contentType || 'application/octet-stream',
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.file_name)}`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-cache',
    },
  })
}
