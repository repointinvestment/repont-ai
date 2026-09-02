// lib/policyFundsStore.js
// 정책자금 마스터 DB 접근 헬퍼.
// - ensureSchema(): 테이블이 없으면 만들고, 비어있으면 lib/policyFundsSeed.js로 최초 1회 채움.
//   (관리자가 Neon SQL Editor에서 따로 실행할 필요 없이, API가 처음 호출될 때 자동으로 준비됨)
// - 이후 모든 수정은 /admin/policy-funds 화면 → 이 헬퍼 → DB. 시드 파일은 다시 쓰이지 않음.

import { sql } from '@/lib/db'
import { SEED_FUNDS, SEED_COMMON_RULES } from '@/lib/policyFundsSeed'

let schemaReady = false

export async function ensureSchema() {
  if (schemaReady) return
  await sql`
    CREATE TABLE IF NOT EXISTS policy_funds (
      id SERIAL PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      institution TEXT,
      fund_type TEXT,
      limit_operating INTEGER,
      limit_facility INTEGER,
      cap_group TEXT,
      rate_note TEXT,
      period_note TEXT,
      eligibility_summary TEXT,
      conditions JSONB DEFAULT '[]'::jsonb,
      smart_devices JSONB DEFAULT '[]'::jsonb,
      criteria JSONB DEFAULT '{}'::jsonb,
      reapply_rule JSONB DEFAULT '{}'::jsonb,
      required_docs JSONB DEFAULT '[]'::jsonb,
      exclusive_group TEXT,
      notes TEXT,
      active BOOLEAN DEFAULT TRUE,
      sort_order INTEGER DEFAULT 0,
      updated_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS policy_fund_common_rules (
      id SERIAL PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      params JSONB DEFAULT '{}'::jsonb,
      sort_order INTEGER DEFAULT 0,
      updated_by TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `

  const [{ count: fundCount }] = await sql`SELECT COUNT(*)::int AS count FROM policy_funds`
  if (fundCount === 0) {
    for (const f of SEED_FUNDS) await insertFund({ ...f, updated_by: 'seed' })
  }
  const [{ count: ruleCount }] = await sql`SELECT COUNT(*)::int AS count FROM policy_fund_common_rules`
  if (ruleCount === 0) {
    for (const r of SEED_COMMON_RULES) await upsertCommonRule({ ...r, updated_by: 'seed' })
  }
  schemaReady = true
}

const j = (v, fallback) => JSON.stringify(v ?? fallback)

async function insertFund(f) {
  const [row] = await sql`
    INSERT INTO policy_funds
      (key, name, institution, fund_type, limit_operating, limit_facility, cap_group, rate_note, period_note,
       eligibility_summary, conditions, smart_devices, criteria, reapply_rule, required_docs,
       exclusive_group, notes, active, sort_order, updated_by)
    VALUES
      (${f.key}, ${f.name}, ${f.institution ?? null}, ${f.fund_type ?? null},
       ${f.limit_operating ?? null}, ${f.limit_facility ?? null}, ${f.cap_group ?? null},
       ${f.rate_note ?? null}, ${f.period_note ?? null}, ${f.eligibility_summary ?? null},
       ${j(f.conditions, [])}::jsonb, ${j(f.smart_devices, [])}::jsonb, ${j(f.criteria, {})}::jsonb,
       ${j(f.reapply_rule, {})}::jsonb, ${j(f.required_docs, [])}::jsonb,
       ${f.exclusive_group ?? null}, ${f.notes ?? null}, ${f.active ?? true}, ${f.sort_order ?? 0}, ${f.updated_by ?? null})
    ON CONFLICT (key) DO NOTHING
    RETURNING *
  `
  return row
}

export async function listFunds({ activeOnly = false } = {}) {
  await ensureSchema()
  const rows = activeOnly
    ? await sql`SELECT * FROM policy_funds WHERE active = TRUE ORDER BY sort_order, id`
    : await sql`SELECT * FROM policy_funds ORDER BY sort_order, id`
  return rows
}

export async function getFund(id) {
  await ensureSchema()
  const [row] = await sql`SELECT * FROM policy_funds WHERE id = ${id}`
  return row || null
}

export async function createFund(f) {
  await ensureSchema()
  if (!f.key) f.key = `fund_${Date.now()}`
  return insertFund(f)
}

export async function updateFund(id, f) {
  await ensureSchema()
  const [row] = await sql`
    UPDATE policy_funds SET
      name = ${f.name},
      institution = ${f.institution ?? null},
      fund_type = ${f.fund_type ?? null},
      limit_operating = ${f.limit_operating ?? null},
      limit_facility = ${f.limit_facility ?? null},
      cap_group = ${f.cap_group ?? null},
      rate_note = ${f.rate_note ?? null},
      period_note = ${f.period_note ?? null},
      eligibility_summary = ${f.eligibility_summary ?? null},
      conditions = ${j(f.conditions, [])}::jsonb,
      smart_devices = ${j(f.smart_devices, [])}::jsonb,
      criteria = ${j(f.criteria, {})}::jsonb,
      reapply_rule = ${j(f.reapply_rule, {})}::jsonb,
      required_docs = ${j(f.required_docs, [])}::jsonb,
      exclusive_group = ${f.exclusive_group ?? null},
      notes = ${f.notes ?? null},
      active = ${f.active ?? true},
      sort_order = ${f.sort_order ?? 0},
      updated_by = ${f.updated_by ?? null},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `
  return row || null
}

export async function deleteFund(id) {
  await ensureSchema()
  await sql`DELETE FROM policy_funds WHERE id = ${id}`
}

export async function listCommonRules() {
  await ensureSchema()
  return sql`SELECT * FROM policy_fund_common_rules ORDER BY sort_order, id`
}

export async function upsertCommonRule(r) {
  const [row] = await sql`
    INSERT INTO policy_fund_common_rules (key, title, content, params, sort_order, updated_by)
    VALUES (${r.key}, ${r.title}, ${r.content ?? null}, ${j(r.params, {})}::jsonb, ${r.sort_order ?? 0}, ${r.updated_by ?? null})
    ON CONFLICT (key) DO UPDATE SET
      title = EXCLUDED.title,
      content = EXCLUDED.content,
      params = EXCLUDED.params,
      sort_order = EXCLUDED.sort_order,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
    RETURNING *
  `
  return row
}

export async function deleteCommonRule(key) {
  await ensureSchema()
  await sql`DELETE FROM policy_fund_common_rules WHERE key = ${key}`
}
