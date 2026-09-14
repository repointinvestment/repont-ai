// app/api/consultant/profile/route.js
// 컨설턴트 본인 프로필(이름은 계정에 이미 있음, 여기선 사진·소개만) — 자가진단 페이지(/apply/[아이디])에
// "OOO 담당자가 검토해드려요"처럼 개인화해서 보여주는 데 씀. 사진은 고객도 보는 공개 페이지라 public으로 저장.

import { sql } from '@/lib/db'
import { put } from '@vercel/blob'
import { NextResponse } from 'next/server'

let schemaReady = false
async function ensureSchema() {
  if (schemaReady) return
  await sql`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS profile_photo_url TEXT`
  await sql`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS profile_intro TEXT`
  schemaReady = true
}

// 본인 것 조회 (사진·소개) — 인증 없이도 자가진단 공개 페이지에서 읽을 수 있어야 해서 username을
// 쿼리 파라미터로도 받음(그 경우 소개 텍스트만, 민감정보 없음이라 문제 없음).
export async function GET(request) {
  await ensureSchema()
  const { searchParams } = new URL(request.url)
  const qUsername = searchParams.get('username')
  const username = qUsername || request.headers.get('x-consultant-id')
  if (!username) return NextResponse.json({ error: '아이디가 필요합니다.' }, { status: 400 })
  const [row] = await sql`SELECT username, name, profile_photo_url, profile_intro FROM accounts WHERE username = ${username}`
  if (!row) return NextResponse.json({ profile: null })
  return NextResponse.json({ profile: row })
}

export async function POST(request) {
  await ensureSchema()
  const username = request.headers.get('x-consultant-id')
  if (!username) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  try {
    const formData = await request.formData()
    const file = formData.get('photo')
    const intro = formData.get('intro')

    let photoUrl
    if (file && typeof file === 'object' && file.size > 0) {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        return NextResponse.json({ error: '이미지 파일(png/jpg/webp)만 업로드 가능합니다.' }, { status: 400 })
      }
      const blob = await put(`profiles/${username}-${Date.now()}`, file, { access: 'public' })
      photoUrl = blob.url
    }

    const [row] = await sql`
      UPDATE accounts SET
        profile_photo_url = COALESCE(${photoUrl || null}, profile_photo_url),
        profile_intro = COALESCE(${intro ?? null}, profile_intro)
      WHERE username = ${username}
      RETURNING username, name, profile_photo_url, profile_intro
    `
    if (!row) return NextResponse.json({ error: '계정을 찾을 수 없습니다.' }, { status: 404 })
    return NextResponse.json({ ok: true, profile: row })
  } catch (err) {
    console.error('프로필 업로드 실패:', err)
    return NextResponse.json({ error: `업로드 실패: ${err.message}` }, { status: 500 })
  }
}
