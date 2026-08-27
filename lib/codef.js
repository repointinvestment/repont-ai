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
    body: JSON.stringify(body),
  })

  const raw = await res.text()
  let parsed = safeJsonParse(raw)
  // CODEF는 응답 전체가 문자열로 한 번 더 감싸져 오는 경우가 있어 한 번 더 시도
  if (typeof parsed === 'string') {
    const reparsed = safeJsonParse(parsed) ?? safeJsonParse(decodeURIComponent(parsed))
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

// data.continue2Way === true 이면 간편인증/전자서명 추가 인증이 필요한 상태.
export function needsTwoWay(codefResult) {
  return codefResult?.data?.continue2Way === true || codefResult?.result?.code === 'CF-03002'
}
