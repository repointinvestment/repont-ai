// lib/companyMessagingConfig.js
// 회사(리포인트파트너스) 명의 솔라피 계정 — API키·시크릿·알림톡 템플릿·발신번호를 딱 한 번만 설정해두고
// 전체 컨설턴트가 공유해서 씀. 컨설턴트마다 따로 계정을 만들 필요 없음(대표가 컨설턴트 늘 때마다
// 솔라피 콘솔에 직접 들어가서 수작업으로 연동해줘야 하는 부담을 없애기 위한 구조).
// 컨설턴트별로 진짜 다른 값은 자기 카카오 채널 프로필키(pfId)뿐 — 그건 lib/consultantChannelStore.js에서 관리.

import { sql } from '@/lib/db'
import { encrypt, decrypt } from '@/lib/crypto'

let schemaReady = false

export async function ensureSchema() {
  if (schemaReady) return
  await sql`
    CREATE TABLE IF NOT EXISTS company_messaging_config (
      id INTEGER PRIMARY KEY DEFAULT 1,
      provider TEXT NOT NULL DEFAULT 'solapi',
      api_key TEXT,
      api_secret_encrypted TEXT,
      template_id TEXT,
      sender_phone TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT single_row CHECK (id = 1)
    )
  `
  schemaReady = true
}

export async function getCompanyConfigForSending() {
  await ensureSchema()
  const [row] = await sql`SELECT * FROM company_messaging_config WHERE id = 1`
  if (!row) return null
  return {
    provider: row.provider,
    apiKey: row.api_key,
    apiSecret: row.api_secret_encrypted ? decrypt(row.api_secret_encrypted) : null,
    templateId: row.template_id,
    senderPhone: row.sender_phone,
  }
}

export async function getCompanyConfigForDisplay() {
  await ensureSchema()
  const [row] = await sql`SELECT * FROM company_messaging_config WHERE id = 1`
  if (!row) return null
  return {
    apiKey: row.api_key || '',
    apiSecretMasked: row.api_secret_encrypted ? '••••••••' + decrypt(row.api_secret_encrypted).slice(-4) : '',
    hasApiSecret: !!row.api_secret_encrypted,
    templateId: row.template_id || '',
    senderPhone: row.sender_phone || '',
    updatedAt: row.updated_at,
  }
}

export async function isCompanyConfigured() {
  await ensureSchema()
  const [row] = await sql`SELECT api_key, api_secret_encrypted, template_id FROM company_messaging_config WHERE id = 1`
  return !!(row && row.api_key && row.api_secret_encrypted && row.template_id)
}

export async function upsertCompanyConfig({ apiKey, apiSecret, templateId, senderPhone }) {
  await ensureSchema()
  const existing = await sql`SELECT api_secret_encrypted FROM company_messaging_config WHERE id = 1`
  const secretToStore = apiSecret ? encrypt(apiSecret) : (existing[0]?.api_secret_encrypted ?? null)

  const [row] = await sql`
    INSERT INTO company_messaging_config (id, api_key, api_secret_encrypted, template_id, sender_phone, updated_at)
    VALUES (1, ${apiKey || null}, ${secretToStore}, ${templateId || null}, ${senderPhone || null}, NOW())
    ON CONFLICT (id) DO UPDATE SET
      api_key = ${apiKey || null},
      api_secret_encrypted = ${secretToStore},
      template_id = ${templateId || null},
      sender_phone = ${senderPhone || null},
      updated_at = NOW()
    RETURNING *
  `
  return row
}
