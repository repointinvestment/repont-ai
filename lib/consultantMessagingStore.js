// lib/consultantMessagingStore.js
// 컨설턴트별로 자기 솔라피(카카오 알림톡) 계정을 따로 연결 — 회사 전체가 공유하는 키 하나가 아니라,
// 각자 자기 카카오 비즈니스 채널로 자기 고객한테 보냄. 구독 상품으로 팔 수 있으려면 컨설턴트가
// API 키만 붙여넣으면 되도록 설정 UI가 단순해야 함(솔라피 가입·채널 연동까지는 컨설턴트 본인이 하고,
// 발급받은 키를 우리 쪽에 넣기만 하면 연동 완료).
// API 시크릿은 lib/crypto.js(주민등록번호 등에 쓰는 것과 동일한 AES 암호화)로 암호화해서 저장.

import { sql } from '@/lib/db'
import { encrypt, decrypt } from '@/lib/crypto'

let schemaReady = false

export async function ensureSchema() {
  if (schemaReady) return
  await sql`
    CREATE TABLE IF NOT EXISTS consultant_messaging_configs (
      consultant_username TEXT PRIMARY KEY,
      provider TEXT NOT NULL DEFAULT 'solapi',
      api_key TEXT,
      api_secret_encrypted TEXT,
      sender_key TEXT,       -- 카카오 채널 프로필키(pfId)
      sender_phone TEXT,     -- 발신번호(SMS 대체발송용)
      template_id TEXT,      -- 알림톡 템플릿 ID(심사 승인된 것)
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  schemaReady = true
}

// 시크릿을 복호화해서 돌려줌 — 발송 시에만 사용, 화면에 그대로 보여주면 안 됨.
export async function getConfigForSending(consultantUsername) {
  await ensureSchema()
  const [row] = await sql`SELECT * FROM consultant_messaging_configs WHERE consultant_username = ${consultantUsername} AND is_active = true`
  if (!row) return null
  return {
    provider: row.provider,
    apiKey: row.api_key,
    apiSecret: row.api_secret_encrypted ? decrypt(row.api_secret_encrypted) : null,
    senderKey: row.sender_key,
    senderPhone: row.sender_phone,
    templateId: row.template_id,
  }
}

// 화면에 보여줄 때는 시크릿을 마스킹(마지막 4자리만)해서 돌려줌 — 저장된 값을 다시 평문으로 노출하지 않음.
export async function getConfigForDisplay(consultantUsername) {
  await ensureSchema()
  const [row] = await sql`SELECT * FROM consultant_messaging_configs WHERE consultant_username = ${consultantUsername}`
  if (!row) return null
  return {
    provider: row.provider,
    apiKey: row.api_key || '',
    apiSecretMasked: row.api_secret_encrypted ? '••••••••' + decrypt(row.api_secret_encrypted).slice(-4) : '',
    hasApiSecret: !!row.api_secret_encrypted,
    senderKey: row.sender_key || '',
    senderPhone: row.sender_phone || '',
    templateId: row.template_id || '',
    isActive: row.is_active,
    updatedAt: row.updated_at,
  }
}

export async function isConfigured(consultantUsername) {
  await ensureSchema()
  const [row] = await sql`SELECT api_key, api_secret_encrypted, sender_key, template_id FROM consultant_messaging_configs WHERE consultant_username = ${consultantUsername} AND is_active = true`
  return !!(row && row.api_key && row.api_secret_encrypted && row.sender_key && row.template_id)
}

// apiSecret이 빈 문자열/undefined로 오면(마스킹된 값을 그대로 다시 저장하려는 경우) 기존 값을 유지.
export async function upsertConfig(consultantUsername, { apiKey, apiSecret, senderKey, senderPhone, templateId, isActive }) {
  await ensureSchema()
  const existing = await sql`SELECT api_secret_encrypted FROM consultant_messaging_configs WHERE consultant_username = ${consultantUsername}`
  const secretToStore = apiSecret ? encrypt(apiSecret) : (existing[0]?.api_secret_encrypted ?? null)

  const [row] = await sql`
    INSERT INTO consultant_messaging_configs (consultant_username, api_key, api_secret_encrypted, sender_key, sender_phone, template_id, is_active, updated_at)
    VALUES (${consultantUsername}, ${apiKey || null}, ${secretToStore}, ${senderKey || null}, ${senderPhone || null}, ${templateId || null}, ${isActive !== false}, NOW())
    ON CONFLICT (consultant_username) DO UPDATE SET
      api_key = ${apiKey || null},
      api_secret_encrypted = ${secretToStore},
      sender_key = ${senderKey || null},
      sender_phone = ${senderPhone || null},
      template_id = ${templateId || null},
      is_active = ${isActive !== false},
      updated_at = NOW()
    RETURNING *
  `
  return row
}
