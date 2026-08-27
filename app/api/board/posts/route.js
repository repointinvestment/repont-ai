// app/api/board/posts/route.js
import { sql } from '@/lib/db'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const rows = await sql`
    SELECT p.id, p.title, p.content, p.author_name, p.author_role, p.created_at,
           (SELECT COUNT(*)::int FROM board_comments c WHERE c.post_id = p.id) AS comment_count,
           (SELECT COUNT(*)::int FROM board_post_files f WHERE f.post_id = p.id) AS file_count
    FROM board_posts p
    ORDER BY p.created_at DESC
  `
  return NextResponse.json({ posts: rows })
}

export async function POST(request) {
  const username = request.headers.get('x-consultant-id')
  const role = request.headers.get('x-consultant-role')
  const body = await request.json()
  const name = body.authorName || username

  if (!username) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  if (!body.title || !body.content) {
    return NextResponse.json({ error: '제목과 내용을 입력해주세요.' }, { status: 400 })
  }

  const [post] = await sql`
    INSERT INTO board_posts (author_username, author_name, author_role, title, content)
    VALUES (${username}, ${name}, ${role}, ${body.title}, ${body.content})
    RETURNING id
  `

  return NextResponse.json({ post })
}
