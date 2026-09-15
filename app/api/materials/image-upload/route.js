// app/api/materials/image-upload/route.js
// 안내자료 안에 넣을 이미지 업로드 — 고객도 보는 공개 페이지라 public으로 저장.

import { put } from '@vercel/blob'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const username = request.headers.get('x-consultant-id')
  if (!username) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  try {
    const formData = await request.formData()
    const file = formData.get('image')
    if (!file || typeof file !== 'object') return NextResponse.json({ error: '이미지가 없습니다.' }, { status: 400 })
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
      return NextResponse.json({ error: '이미지 파일(png/jpg/webp/gif)만 업로드 가능합니다.' }, { status: 400 })
    }
    const blob = await put(`materials/${username}-${Date.now()}-${file.name}`, file, { access: 'public' })
    return NextResponse.json({ url: blob.url })
  } catch (err) {
    console.error('안내자료 이미지 업로드 실패:', err)
    return NextResponse.json({ error: `업로드 실패: ${err.message}` }, { status: 500 })
  }
}
