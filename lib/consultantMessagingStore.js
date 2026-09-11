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
      request_status TEXT NOT NULL DEFAULT 'none', -- 'none' | 'requested' | 'in_progress' | 'active'
      request_business_name TEXT,
      request_biz_reg_number TEXT,
      request_phone TEXT,
      request_email TEXT,
      request_note TEXT,
      requested_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`ALTER TABLE consultant_messaging_configs ADD COLUMN IF NOT EXISTS request_status TEXT NOT NULL DEFAULT 'none'`
  await sql`ALTER TABLE consultant_messaging_configs ADD COLUMN IF NOT EXISTS request_business_name TEXT`
  await sql`ALTER TABLE consultant_messaging_configs ADD COLUMN IF NOT EXISTS request_biz_reg_number TEXT`
  await sql`ALTER TABLE consultant_messaging_configs ADD COLUMN IF NOT EXISTS request_phone TEXT`
  await sql`ALTER TABLE consultant_messaging_configs ADD COLUMN IF NOT EXISTS request_email TEXT`
  await sql`ALTER TABLE consultant_messaging_configs ADD COLUMN IF NOT EXISTS request_note TEXT`
  await sql`ALTER TABLE consultant_messaging_configs ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ`
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
    requestStatus: row.request_status,
    requestBusinessName: row.request_business_name || '',
    requestBizRegNumber: row.request_biz_reg_number || '',
    requestPhone: row.request_phone || '',
    requestEmail: row.request_email || '',
    requestNote: row.request_note || '',
    requestedAt: row.requested_at,
  }
}

// 컨설턴트가 기술 값 없이 회사 기본정보만 내면 "연동 신청" 상태로 저장 — 실제 솔라피/카카오 설정은
// 대표(관리자)가 뒤에서 대신 처리(또는 컨설턴트에게 남은 절차를 안내)한 뒤 upsertConfig로 키를 넣어줌.
export async function submitRequest(consultantUsername, { businessName, bizRegNumber, phone, email, note }) {
  await ensureSchema()
  const [row] = await sql`
    INSERT INTO consultant_messaging_configs (consultant_username, request_status, request_business_name, request_biz_reg_number, request_phone, request_email, request_note, requested_at, updated_at)
    VALUES (${consultantUsername}, 'requested', ${businessName || null}, ${bizRegNumber || null}, ${phone || null}, ${email || null}, ${note || null}, NOW(), NOW())
    ON CONFLICT (consultant_username) DO UPDATE SET
      request_status = 'requested',
      request_business_name = ${businessName || null},
      request_biz_reg_number = ${bizRegNumber || null},
      request_phone = ${phone || null},
      request_email = ${email || null},
      request_note = ${note || null},
      requested_at = NOW(),
      updated_at = NOW()
    RETURNING *
  `
  return row
}

export async function listRequests() {
  await ensureSchema()
  return sql`
    SELECT ccc.*, a.name AS consultant_name
    FROM consultant_messaging_configs ccc
    LEFT JOIN accounts a ON a.username = ccc.consultant_username
    WHERE ccc.request_status != 'none'
    ORDER BY (ccc.request_status = 'requested') DESC, ccc.requested_at DESC NULLS LAST
  `
}

export async function setRequestStatus(consultantUsername, status) {
  await ensureSchema()
  await sql`UPDATE consultant_messaging_configs SET request_status = ${status}, updated_at = NOW() WHERE consultant_username = ${consultantUsername}`
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
  const nextRequestStatus = (apiKey && secretToStore && senderKey && templateId) ? 'active' : undefined

  const [row] = await sql`
    INSERT INTO consultant_messaging_configs (consultant_username, api_key, api_secret_encrypted, sender_key, sender_phone, template_id, is_active, request_status, updated_at)
    VALUES (${consultantUsername}, ${apiKey || null}, ${secretToStore}, ${senderKey || null}, ${senderPhone || null}, ${templateId || null}, ${isActive !== false}, ${nextRequestStatus || 'none'}, NOW())
    ON CONFLICT (consultant_username) DO UPDATE SET
      api_key = ${apiKey || null},
      api_secret_encrypted = ${secretToStore},
      sender_key = ${senderKey || null},
      sender_phone = ${senderPhone || null},
      template_id = ${templateId || null},
      is_active = ${isActive !== false},
      request_status = COALESCE(${nextRequestStatus || null}, consultant_messaging_configs.request_status),
      updated_at = NOW()
    RETURNING *
  `
  return row
}
