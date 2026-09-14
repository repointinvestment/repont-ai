// lib/consultantChannelStore.js
// 컨설턴트별로 진짜 다른 건 자기 카카오 채널 프로필키(pfId)뿐 — API키·템플릿은 회사 공용
// (lib/companyMessagingConfig.js). 컨설턴트는 채널만 만들어서 "연동 신청"하고, 대표가 그 채널을
// 회사 솔라피 계정에 연동한 뒤 발급된 pfId를 여기 넣어주면 끝.

import { sql } from '@/lib/db'

let schemaReady = false

export async function ensureSchema() {
  if (schemaReady) return
  await sql`
    CREATE TABLE IF NOT EXISTS consultant_channels (
      consultant_username TEXT PRIMARY KEY,
      sender_key TEXT,       -- 카카오 채널 프로필키(pfId) — 대표가 연동 후 입력
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
  schemaReady = true
}

export async function getChannel(consultantUsername) {
  await ensureSchema()
  const [row] = await sql`SELECT * FROM consultant_channels WHERE consultant_username = ${consultantUsername}`
  return row || null
}

export async function isChannelLinked(consultantUsername) {
  await ensureSchema()
  const [row] = await sql`SELECT sender_key, is_active FROM consultant_channels WHERE consultant_username = ${consultantUsername}`
  return !!(row && row.sender_key && row.is_active)
}

// 컨설턴트가 기술 값 없이 회사 기본정보만 내면 "연동 신청" 상태로 저장 — 실제 채널 연동은 대표가 처리.
export async function submitRequest(consultantUsername, { businessName, bizRegNumber, phone, email, note }) {
  await ensureSchema()
  const [row] = await sql`
    INSERT INTO consultant_channels (consultant_username, request_status, request_business_name, request_biz_reg_number, request_phone, request_email, request_note, requested_at, updated_at)
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
    SELECT cc.*, a.name AS consultant_name
    FROM consultant_channels cc
    LEFT JOIN accounts a ON a.username = cc.consultant_username
    WHERE cc.request_status != 'none'
    ORDER BY (cc.request_status = 'requested') DESC, cc.requested_at DESC NULLS LAST
  `
}

export async function setRequestStatus(consultantUsername, status) {
  await ensureSchema()
  await sql`UPDATE consultant_channels SET request_status = ${status}, updated_at = NOW() WHERE consultant_username = ${consultantUsername}`
}

// 대표가 연동 완료 후 채널 프로필키(pfId)를 대신 입력 — 이 순간 request_status가 'active'로 바뀜.
export async function setSenderKey(consultantUsername, senderKey) {
  await ensureSchema()
  const [row] = await sql`
    INSERT INTO consultant_channels (consultant_username, sender_key, request_status, updated_at)
    VALUES (${consultantUsername}, ${senderKey}, 'active', NOW())
    ON CONFLICT (consultant_username) DO UPDATE SET
      sender_key = ${senderKey},
      request_status = 'active',
      updated_at = NOW()
    RETURNING *
  `
  return row
}
