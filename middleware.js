// middleware.js
// 모든 /api 요청의 신원(x-consultant-id / x-consultant-role)을 "서명된 세션 쿠키"로만 결정합니다.
//  1) 요청에 실려온 x-consultant-* 헤더는 무조건 버림 (클라이언트가 위조 가능하므로)
//  2) 유효한 세션 쿠키가 있으면 거기서 꺼낸 값으로 헤더를 새로 채움 → 기존 API 코드는 수정 없이 그대로 동작
//  3) 체험(trial) 계정은 허용 목록에 있는 API만 호출 가능 (기본 거부)
import { NextResponse } from 'next/server'
import { verifySession, SESSION_COOKIE } from '@/lib/sessionToken'

// 체험 계정이 쓸 수 있는 API (이 목록에 없으면 403). 비용이 드는 외부 연동·공개 발행·메시지 발송은 전부 제외.
const TRIAL_ALLOWED_PREFIXES = [
  '/api/auth',
  '/api/chat',
  '/api/business-plan',
  '/api/business-plans',
  '/api/policy-funds',
  '/api/bizinfo',
  '/api/reports/summary',
]
// /api/customers 중에서 체험 계정이 쓸 수 있는 것(기본 CRUD·진행현황·신청이력). 파일/계정정보/발송/서류발급 계열은 제외.
const TRIAL_CUSTOMER_PATTERNS = [
  /^\/api\/customers\/?$/,
  /^\/api\/customers\/\d+\/?$/,
  /^\/api\/customers\/\d+\/status-history\/?$/,
  /^\/api\/customers\/\d+\/applications(\/\d+)?\/?$/,
]

function trialAllowed(pathname) {
  if (TRIAL_ALLOWED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) return true
  return TRIAL_CUSTOMER_PATTERNS.some((re) => re.test(pathname))
}

export async function middleware(request) {
  const headers = new Headers(request.headers)
  headers.delete('x-consultant-id')
  headers.delete('x-consultant-role')

  const token = request.cookies.get(SESSION_COOKIE)?.value
  const session = await verifySession(token)

  if (session) {
    headers.set('x-consultant-id', session.u)
    headers.set('x-consultant-role', session.r)
    if (session.r === 'trial' && !trialAllowed(request.nextUrl.pathname)) {
      return NextResponse.json({ error: '체험 계정에서는 사용할 수 없는 기능입니다.' }, { status: 403 })
    }
  }

  return NextResponse.next({ request: { headers } })
}

export const config = {
  matcher: ['/api/:path*'],
}
