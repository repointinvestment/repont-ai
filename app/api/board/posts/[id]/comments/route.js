// app/api/board/posts/[id]/comments/route.js
import { sql } from '@/lib/db'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request, { params }) {
  const { id } = params
  const username = request.headers.get('x-consultant-id')
  const role = request.headers.get('x-consultant-role')
  const body = await request.json()
  const name = body.authorName || username

  if (!username) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  if (!body.content) {
    return NextResponse.json({ error: '댓글 내용을 입력해주세요.' }, { status: 400 })
  }

  const [comment] = await sql`
    INSERT INTO board_comments (post_id, author_username, author_name, author_role, content)
    VALUES (${id}, ${username}, ${name}, ${role}, ${body.content})
    RETURNING id, author_name, author_role, content, created_at
  `

  return NextResponse.json({ comment })
}
