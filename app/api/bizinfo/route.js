import { NextResponse } from 'next/server'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category') || '금융'
  const pageUnit = searchParams.get('pageUnit') || '100'

  const url = `https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do?hshsKcd=${encodeURIComponent(category)}&dataType=json&pageUnit=${pageUnit}&pageIndex=1&serviceKey=ra31hj`

  try {
    const res = await fetch(url)
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: '데이터 로딩 실패' }, { status: 500 })
  }
}
