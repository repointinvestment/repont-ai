// lib/referralsStore.js
// "문수환 대표에게 의뢰" 기능 (로드맵 5번).
// 진단 결과 법인전환·절세·상속처럼 정책자금 범위를 넘는 이슈가 보이면 컨설턴트가 케이스를 대표에게 이관.
// 자동 감지가 아니라 컨설턴트가 직접 트리거(이슈 유형 선택 + 메모) — 정책자금 진단 엔진에는 아직
// 법인/세무/상속 판단 로직이 없어서, 사람이 판단해서 넘기는 방식이 정확함.

import { sql } from '@/lib/db'

let schemaReady = false

export const ISSUE_TYPES = ['법인전환', '절세', '상속', '기타']
export const REFERRAL_STATUSES = ['대기', '처리중', '완료']

export async function ensureSchema() {
  if (schemaReady) return
  await sql`
    CREATE TABLE IF NOT EXISTS fund_referrals (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      issue_type TEXT NOT NULL,
      note TEXT,
      status TEXT NOT NULL DEFAULT '대기',
      admin_note TEXT,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_fund_referrals_status ON fund_referrals(status)`
  schemaReady = true
}

export async function listReferrals({ status = null } = {}) {
  await ensureSchema()
  const rows = status
    ? await sql`
        SELECT r.*, c.owner_name, c.business_name, c.phone
        FROM fund_referrals r JOIN customers c ON c.id = r.customer_id
        WHERE r.status = ${status} ORDER BY r.created_at DESC`
    : await sql`
        SELECT r.*, c.owner_name, c.business_name, c.phone
        FROM fund_referrals r JOIN customers c ON c.id = r.customer_id
        ORDER BY (r.status = '대기') DESC, r.created_at DESC`
  return rows
}

export async function listReferralsForCustomer(customerId) {
  await ensureSchema()
  return sql`SELECT * FROM fund_referrals WHERE customer_id = ${customerId} ORDER BY created_at DESC`
}

export async function createReferral(customerId, { issueType, note }, createdBy) {
  await ensureSchema()
  const [row] = await sql`
    INSERT INTO fund_referrals (customer_id, issue_type, note, created_by)
    VALUES (${customerId}, ${issueType}, ${note || null}, ${createdBy || null})
    RETURNING *
  `
  return row
}

export async function updateReferralStatus(id, { status, adminNote }) {
  await ensureSchema()
  const [row] = await sql`
    UPDATE fund_referrals SET
      status = COALESCE(${status || null}, status),
      admin_note = COALESCE(${adminNote ?? null}, admin_note),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `
  return row || null
}
