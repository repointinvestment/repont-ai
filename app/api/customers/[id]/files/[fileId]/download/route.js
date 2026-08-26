// app/api/customers/[id]/files/[fileId]/download/route.js
// Private Blob 파일을 스트리밍으로 내려줌. 담당 컨설턴트 본인이거나 관리자만 접근 가능.
import { sql } from '@/lib/db'
import { get } from '@vercel/blob'
import { NextResponse } from 'next/server'

export async function GET(request, { params }) {
  const { id, fileId } = params
  const consultantId = request.headers.get('x-consultant-id')
  const role = request.headers.get('x-consultant-role')

  const rows = await sql`
    SELECT cf.file_name, cf.blob_url, c.consultant_id
    FROM customer_files cf
    JOIN customers c ON c.id = cf.customer_id
    WHERE cf.id = ${fileId} AND cf.customer_id = ${id}
  `
  if (rows.length === 0) {
    return NextResponse.json({ error: '파일을 찾을 수 없습니다.' }, { status: 404 })
  }

  const file = rows[0]
  const isOwner = String(file.consultant_id) === String(consultantId)
  const isAdmin = role === 'admin'
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }

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
