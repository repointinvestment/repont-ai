// lib/crypto.js
// 고객 계정 비밀번호(아이핀/진흥공단 등)를 암호화해서 DB에 저장하기 위한 유틸.
// 주민등록번호·공동인증서 비밀번호는 이 유틸을 써도 저장하지 않는다 — 애초에 필드가 없음.

import crypto from 'crypto'

const ALGO = 'aes-256-gcm'

// Vercel 프로젝트 Settings → Environment Variables에 CREDENTIAL_ENCRYPTION_KEY 이름으로
// 32바이트(64자리 hex) 랜덤 키를 등록해야 함. 아래 명령으로 한 번 생성해서 등록:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
const KEY = Buffer.from(process.env.CREDENTIAL_ENCRYPTION_KEY, 'hex')

export function encrypt(plainText) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, KEY, iv)
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  // iv:authTag:암호문 을 하나의 문자열로 합쳐서 저장
  return [iv, authTag, encrypted].map(b => b.toString('base64')).join(':')
}

export function decrypt(stored) {
  const [ivB64, tagB64, dataB64] = stored.split(':')
  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(tagB64, 'base64')
  const data = Buffer.from(dataB64, 'base64')
  const decipher = crypto.createDecipheriv(ALGO, KEY, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
  return decrypted.toString('utf8')
}
