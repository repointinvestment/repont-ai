// lib/policyFundsStore.js
// 정책자금 마스터 DB 접근 헬퍼.
// - ensureSchema(): 테이블이 없으면 만들고, 시드 버전(lib/policyFundsSeed.js의 SEED_VERSION)이 바뀌었으면
//   시드 항목을 DB에 갱신함. 관리자 화면에서 직접 고친 행(updated_by != 'seed')은 덮어쓰지 않음.
//   (관리자가 Neon SQL Editor에서 따로 실행할 필요 없이, API가 처음 호출될 때 자동으로 준비됨)
// - 기본 흐름: 대표가 수정사항을 말로 알려줌 → Claude가 시드 파일 수정 + SEED_VERSION 올림 → 배포되면 자동 반영.
//   관리자 화면은 급할 때 직접 고치는 용도(그 행은 이후 시드 갱신에서 보호됨).

import { sql } from '@/lib/db'
import { SEED_FUNDS, SEED_COMMON_RULES, SEED_VERSION } from '@/lib/policyFundsSeed'

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
  await sql`
    CREATE TABLE IF NOT EXISTS policy_fund_meta (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `

  // 시드 버전이 바뀌었으면(=Claude가 시드 파일을 고쳐서 배포했으면) DB의 시드 항목을 갱신.
  // 관리자 화면에서 직접 고친 항목(updated_by != 'seed')은 건드리지 않음.
  const [meta] = await sql`SELECT value FROM policy_fund_meta WHERE key = 'seed_version'`
  if (!meta || meta.value !== SEED_VERSION) {
    for (const f of SEED_FUNDS) await upsertSeedFund({ ...f, updated_by: 'seed' })
    for (const r of SEED_COMMON_RULES) await upsertSeedRule({ ...r, updated_by: 'seed' })
    await sql`
      INSERT INTO policy_fund_meta (key, value, updated_at) VALUES ('seed_version', ${SEED_VERSION}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `
  }
  schemaReady = true
}

const j = (v, fallback) => JSON.stringify(v ?? fallback)

// 시드 전용 upsert: 없으면 넣고, 있으면 "시드가 마지막으로 만든 행"일 때만 덮어씀.
async function upsertSeedFund(f) {
  await sql`
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
       ${f.exclusive_group ?? null}, ${f.notes ?? null}, ${f.active ?? true}, ${f.sort_order ?? 0}, 'seed')
    ON CONFLICT (key) DO UPDATE SET
      name = EXCLUDED.name, institution = EXCLUDED.institution, fund_type = EXCLUDED.fund_type,
      limit_operating = EXCLUDED.limit_operating, limit_facility = EXCLUDED.limit_facility, cap_group = EXCLUDED.cap_group,
      rate_note = EXCLUDED.rate_note, period_note = EXCLUDED.period_note, eligibility_summary = EXCLUDED.eligibility_summary,
      conditions = EXCLUDED.conditions, smart_devices = EXCLUDED.smart_devices, criteria = EXCLUDED.criteria,
      reapply_rule = EXCLUDED.reapply_rule, required_docs = EXCLUDED.required_docs,
      exclusive_group = EXCLUDED.exclusive_group, notes = EXCLUDED.notes, active = EXCLUDED.active,
      sort_order = EXCLUDED.sort_order, updated_at = NOW()
    WHERE policy_funds.updated_by = 'seed' OR policy_funds.updated_by IS NULL
  `
}

async function upsertSeedRule(r) {
  await sql`
    INSERT INTO policy_fund_common_rules (key, title, content, params, sort_order, updated_by)
    VALUES (${r.key}, ${r.title}, ${r.content ?? null}, ${j(r.params, {})}::jsonb, ${r.sort_order ?? 0}, 'seed')
    ON CONFLICT (key) DO UPDATE SET
      title = EXCLUDED.title, content = EXCLUDED.content, params = EXCLUDED.params,
      sort_order = EXCLUDED.sort_order, updated_at = NOW()
    WHERE policy_fund_common_rules.updated_by = 'seed' OR policy_fund_common_rules.updated_by IS NULL
  `
}

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
