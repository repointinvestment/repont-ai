// app/api/board/posts/[id]/route.js
import { sql } from '@/lib/db'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request, { params }) {
  const { id } = params
  const [post] = await sql`SELECT * FROM board_posts WHERE id = ${id}`
  if (!post) {
    return NextResponse.json({ error: '게시글을 찾을 수 없습니다.' }, { status: 404 })
  }
  const comments = await sql`
    SELECT id, author_name, author_role, content, created_at
    FROM board_comments WHERE post_id = ${id} ORDER BY created_at ASC
  `
  const files = await sql`
    SELECT id, file_name, size_bytes FROM board_post_files WHERE post_id = ${id} ORDER BY id ASC
  `
  return NextResponse.json({ post, comments, files })
}

export async function DELETE(request, { params }) {
  const { id } = params
  const username = request.headers.get('x-consultant-id')
  const role = request.headers.get('x-consultant-role')

  const [post] = await sql`SELECT author_username FROM board_posts WHERE id = ${id}`
  if (!post) {
    return NextResponse.json({ error: '게시글을 찾을 수 없습니다.' }, { status: 404 })
  }
  if (post.author_username !== username && role !== 'admin') {
    return NextResponse.json({ error: '삭제 권한이 없습니다.' }, { status: 403 })
  }

  await sql`DELETE FROM board_posts WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
