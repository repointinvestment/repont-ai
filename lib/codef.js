// lib/codef.js
// CODEF(codef.io) 연동 공통 유틸: OAuth 토큰 발급/캐시, 공개키 RSA 암호화, API 호출 헬퍼.
//
// 필요한 환경변수 (Vercel Production/Preview에 등록):
//   CODEF_CLIENT_ID, CODEF_CLIENT_SECRET  — CODEF 개발자센터 발급
//   CODEF_PUBLIC_KEY                      — CODEF가 제공하는 RSA 공개키. PEM 전체
//                                            (-----BEGIN PUBLIC KEY----- 로 시작) 그대로 저장.
//                                            줄바꿈이 깨지면 \n 문자로 이스케이프해서 저장해도 됨(아래서 복원).
//   CODEF_ENV                             — 'production'이면 정식 버전 사용, 그 외(미설정 포함)는 데모 버전.
//
// 데모 버전은 100 calls/day 제한이 있음. 정식 전환 전까지는 CODEF_ENV를 건드리지 않는다.

import crypto from 'crypto'

const TOKEN_URL = 'https://oauth.codef.io/oauth/token'
const DEMO_BASE = 'https://development.codef.io'
const PROD_BASE = 'https://api.codef.io'

function getBaseUrl() {
  return process.env.CODEF_ENV === 'production' ? PROD_BASE : DEMO_BASE
}

// 서버리스 인스턴스가 warm 상태로 재사용될 때만 유효한 베스트에포트 캐시.
// 콜드 스타트마다 새로 발급되는 건 정상 동작이라 문제 없음.
let cachedToken = null
let cachedTokenExpiresAt = 0

export async function getAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiresAt - 60_000) {
    return cachedToken
  }

  const basicAuth = Buffer.from(
    `${process.env.CODEF_CLIENT_ID}:${process.env.CODEF_CLIENT_SECRET}`
  ).toString('base64')

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=read',
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.access_token) {
    throw new Error(`CODEF 토큰 발급 실패 (${res.status}): ${JSON.stringify(data)}`)
  }

  cachedToken = data.access_token
  cachedTokenExpiresAt = Date.now() + Number(data.expires_in || 3600) * 1000
  return cachedToken
}

// CODEF 공개키로 RSA/ECB/PKCS1Padding 암호화 후 Base64 문자열 반환.
// 주민등록번호 뒷자리, 인증서 비밀번호 등 민감정보 필드에 사용.
export function rsaEncrypt(plainText) {
  let pem = process.env.CODEF_PUBLIC_KEY || ''
  if (!pem) throw new Error('CODEF_PUBLIC_KEY 환경변수가 설정되어 있지 않습니다.')

  // \n으로 이스케이프되어 저장된 경우 실제 개행으로 복원
  if (pem.includes('\\n')) pem = pem.replace(/\\n/g, '\n')
  // 헤더 없이 base64 본문만 저장된 경우 PEM 헤더를 붙여줌
  if (!pem.includes('BEGIN')) {
    pem = `-----BEGIN PUBLIC KEY-----\n${pem}\n-----END PUBLIC KEY-----`
  }

  const encrypted = crypto.publicEncrypt(
    { key: pem, padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(plainText, 'utf8')
  )
  return encrypted.toString('base64')
}

// CODEF는 요청 바디의 각 문자열 값이 URL 인코딩되어 있어야 한다고 요구함
// (안 하면 "암호화된 파라미터에 공백이 포함되어 있습니다" CF-04028 에러 발생 — 암호화 결과의 '+' 등이
//  인코딩 없이 전달되면 자기들 파서가 공백으로 오인하는 것으로 추정).
function urlEncodeValues(value) {
  if (typeof value === 'string') return encodeURIComponent(value)
  if (Array.isArray(value)) return value.map(urlEncodeValues)
  if (value && typeof value === 'object') {
    const out = {}
    for (const key of Object.keys(value)) out[key] = urlEncodeValues(value[key])
    return out
  }
  return value
}

// CODEF API 공통 호출 헬퍼.
// path 예: '/v1/kr/public/nt/proof-issue/corporate-registration'
export async function callCodef(path, body) {
  const token = await getAccessToken()
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json;charset=UTF-8',
    },
    body: JSON.stringify(urlEncodeValues(body)),
  })

  const raw = await res.text()
  // CODEF 응답 바디 자체가 URL 인코딩된 문자열(%7B%22...%7D)로 오는 경우가 있어 먼저 디코딩 시도
  let parsed = safeJsonParse(raw) ?? safeJsonParse(safeDecodeURIComponent(raw))
  // 드물게 한 번 더 문자열로 감싸져 오는 경우까지 방어
  if (typeof parsed === 'string') {
    const reparsed = safeJsonParse(parsed) ?? safeJsonParse(safeDecodeURIComponent(parsed))
    if (reparsed) parsed = reparsed
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`CODEF 응답 파싱 실패 (HTTP ${res.status}): ${raw.slice(0, 500)}`)
  }

  return { httpStatus: res.status, ...parsed }
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function safeDecodeURIComponent(text) {
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}

// data.continue2Way === true 이면 간편인증/전자서명 추가 인증이 필요한 상태.
export function needsTwoWay(codefResult) {
  return codefResult?.data?.continue2Way === true || codefResult?.result?.code === 'CF-03002'
}

// 발급 가능한 국세청 홈택스 증명서 목록.
// 새 문서(예: 소득금액증명원)를 추가할 땐 이 목록에 한 항목만 더 추가하면 됨 — 라우트/화면 코드는 공용.
// loginType — 문서마다 지원하는 로그인 방식이 다름:
//   "6": 비회원 간편인증 (홈택스 회원가입 안 해도 됨) — 사업자등록증명이 여기 해당
//   "5": 회원 간편인증 (홈택스 회원가입 되어있어야 함) — 부가세과세표준증명 등 대부분의 증명서가 여기 해당
export const PRODUCTS = {
  'corporate-registration': {
    label: '사업자등록 증명',
    fileLabel: '사업자등록증명',
    path: '/v1/kr/public/nt/proof-issue/corporate-registration',
    loginType: '6',
    requiresPeriod: false,
  },
  'additional-tax-standard': {
    label: '부가세과세표준증명',
    fileLabel: '부가세과세표준증명',
    path: '/v1/kr/public/nt/proof-issue/additional-tax-standard',
    loginType: '5', // 비회원 간편인증 미지원 — 고객이 홈택스 회원이어야 함
    requiresPeriod: true, // startDate/endDate(과세기간, yyyyMM) 필수
  },
  'financial-statement': {
    label: '재무제표',
    fileLabel: '재무제표',
    path: '/v1/kr/public/nt/proof-issue/standard-financial-statements',
    loginType: '6', // 회원(5)/비회원(6) 간편인증 둘 다 지원 — 다른 비회원 문서들과 세션 공유하려고 6을 기본값으로
    requiresPeriod: false, // 기간이 아니라 단일 귀속연도(개인) 또는 사업연도종료연월(법인) — CodefDocumentIssuance에서 별도 UI로 처리
  },
  'localtax-payment-certificate': {
    label: '지방세 납세증명서',
    fileLabel: '지방세납세증명서',
    path: '/v1/kr/public/mw/localtax-payment-certificate/inquiry',
    loginType: '6', // 단독 조회는 비회원 간편인증(6)으로 충분 — 다건요청으로 묶일 땐 회원(5)으로 강제해야 함
    requiresPeriod: false,
  },
}
