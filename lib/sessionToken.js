// lib/sessionToken.js
// 서명된 세션 토큰(HMAC-SHA256) 생성/검증. Edge(middleware)와 Node 양쪽에서 동작하도록
// Web Crypto(globalThis.crypto.subtle)만 사용합니다.
//
// 왜 필요한가: 예전에는 로그인 결과를 브라우저 localStorage에만 저장하고, API는 요청에 실린
// x-consultant-id / x-consultant-role 헤더를 그대로 믿었습니다. 그러면 누구든 헤더만 붙여서
// 관리자로 행세할 수 있었습니다. 이제는 서버가 발급한 서명 쿠키만 신뢰하고, middleware가
// 그 쿠키에서 꺼낸 값으로 헤더를 덮어씁니다(요청에 실려온 헤더는 전부 버림).

export const SESSION_COOKIE = 'rp_session'
export const SESSION_MAX_SECONDS = 60 * 60 * 24 * 30 // 30일

function getSecret() {
  // 우선 SESSION_SECRET, 없으면 이미 Vercel에 등록돼 있는 CREDENTIAL_ENCRYPTION_KEY를 재사용(서버 전용 비밀값).
  const base = process.env.SESSION_SECRET || process.env.CREDENTIAL_ENCRYPTION_KEY
  if (!base) throw new Error('SESSION_SECRET(또는 CREDENTIAL_ENCRYPTION_KEY) 환경변수가 없습니다.')
  return `rp-session-v1:${base}`
}

const enc = new TextEncoder()

function b64urlFromBytes(bytes) {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function bytesFromB64url(str) {
  const pad = '='.repeat((4 - (str.length % 4)) % 4)
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function hmacKey(usage) {
  return crypto.subtle.importKey('raw', enc.encode(getSecret()), { name: 'HMAC', hash: 'SHA-256' }, false, [usage])
}

// payload: { u: username, r: role }  /  expiresAtMs: 만료 시각(밀리초)
export async function signSession(payload, expiresAtMs) {
  const body = { ...payload, exp: Math.floor(expiresAtMs / 1000) }
  const bodyB64 = b64urlFromBytes(enc.encode(JSON.stringify(body)))
  const key = await hmacKey('sign')
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(bodyB64))
  return `${bodyB64}.${b64urlFromBytes(new Uint8Array(sig))}`
}

// 유효하면 { u, r, exp } 반환, 아니면 null
export async function verifySession(token) {
  try {
    if (!token || typeof token !== 'string') return null
    const [bodyB64, sigB64] = token.split('.')
    if (!bodyB64 || !sigB64) return null
    const key = await hmacKey('verify')
    const ok = await crypto.subtle.verify('HMAC', key, bytesFromB64url(sigB64), enc.encode(bodyB64))
    if (!ok) return null
    const body = JSON.parse(new TextDecoder().decode(bytesFromB64url(bodyB64)))
    if (!body.u || !body.r || !body.exp) return null
    if (body.exp * 1000 < Date.now()) return null
    return body
  } catch {
    return null
  }
}
