// lib/policyFundsStore.js
// 정책자금 마스터 DB 접근 헬퍼.
// - ensureSchema(): 테이블이 없으면 만들고, 시드 버전(lib/policyFundsSeed.js의 SEED_VERSION)이 바뀌었으면
//   시드 항목을 DB에 갱신함. 관리자 화면에서 직접 고친 행(updated_by != 'seed')은 덮어쓰지 않음.
//   (관리자가 Neon SQL Editor에서 따로 실행할 필요 없이, API가 처음 호출될 때 자동으로 준비됨)
// - 기본 흐름: 대표가 수정사항을 말로 알려줌 → Claude가 시드 파일 수정 + SEED_VERSION 올림 → 배포되면 자동 반영.
//   관리자 화면은 급할 때 직접 고치는 용도(그 행은 이후 시드 갱신에서 보호됨).

import { sql } from '@/lib/db'
import { SEED_FUNDS, SEED_COMMON_RULES, SEED_VERSION, SEED_DEPRECATED_KEYS } from '@/lib/policyFundsSeed'

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
  // 실무 사례 DB — 대표(및 이후 수강생)가 실제로 받아준/부결된 건을 익명화해 축적.
  // 규칙(policy_funds)이 "기준선"이라면 사례는 "그 경계선 위에서 실제로 어떻게 갈렸는가".
  // 자격판정 결과의 "유사 사례" 근거, AI 상담 프롬프트의 참고, 수강생 교육 자료로 씀.
  // 고객 식별 정보(이름·사업자번호 등)는 절대 넣지 않음 — 업종·규모·조건만.
  await sql`
    CREATE TABLE IF NOT EXISTS policy_fund_cases (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      fund_key TEXT,
      institution TEXT,
      fund_name TEXT,
      industry TEXT,
      biz_age_years NUMERIC,
      sales INTEGER,
      employees INTEGER,
      credit_score INTEGER,
      existing_loans JSONB DEFAULT '{}'::jsonb,
      outcome TEXT,
      approved_amount INTEGER,
      requested_amount INTEGER,
      rejection_reason TEXT,
      case_date DATE,
      region TEXT,
      lesson TEXT,
      details TEXT,
      tags JSONB DEFAULT '[]'::jsonb,
      source TEXT DEFAULT 'admin',
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `

  // 시드 버전이 바뀌었으면(=Claude가 시드 파일을 고쳐서 배포했으면) DB의 시드 항목을 갱신.
  // 관리자 화면에서 직접 고친 항목(updated_by != 'seed')은 건드리지 않음.
  const [meta] = await sql`SELECT value FROM policy_fund_meta WHERE key = 'seed_version'`
  if (!meta || meta.value !== SEED_VERSION) {
    for (const key of SEED_DEPRECATED_KEYS) {
      await sql`DELETE FROM policy_funds WHERE key = ${key} AND (updated_by = 'seed' OR updated_by IS NULL)`
    }
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

// ───────── 사례 DB ─────────
// existing_loans 예: { 소진공: 3000, 재단: 5000, 신보: 0, 기보: 0, 중진공: 0, 사업자대출: 0 } (만원)
// outcome: '승인' | '감액승인' | '부결' | '진행중' | '기타'
// tags 예: ['보증기관 병행', '대환', '요식업 예외']

const caseFields = (c) => ({
  title: c.title,
  fund_key: c.fund_key || null,
  institution: c.institution || null,
  fund_name: c.fund_name || null,
  industry: c.industry || null,
  biz_age_years: c.biz_age_years ?? null,
  sales: c.sales ?? null,
  employees: c.employees ?? null,
  credit_score: c.credit_score ?? null,
  existing_loans: j(c.existing_loans, {}),
  outcome: c.outcome || null,
  approved_amount: c.approved_amount ?? null,
  requested_amount: c.requested_amount ?? null,
  rejection_reason: c.rejection_reason || null,
  case_date: c.case_date || null,
  region: c.region || null,
  lesson: c.lesson || null,
  details: c.details || null,
  tags: j(c.tags, []),
  source: c.source || 'admin',
})

export async function listCases({ fundKey = null, outcome = null } = {}) {
  await ensureSchema()
  if (fundKey && outcome) return sql`SELECT * FROM policy_fund_cases WHERE fund_key = ${fundKey} AND outcome = ${outcome} ORDER BY case_date DESC NULLS LAST, id DESC`
  if (fundKey) return sql`SELECT * FROM policy_fund_cases WHERE fund_key = ${fundKey} ORDER BY case_date DESC NULLS LAST, id DESC`
  if (outcome) return sql`SELECT * FROM policy_fund_cases WHERE outcome = ${outcome} ORDER BY case_date DESC NULLS LAST, id DESC`
  return sql`SELECT * FROM policy_fund_cases ORDER BY case_date DESC NULLS LAST, id DESC`
}

export async function getCase(id) {
  await ensureSchema()
  const [row] = await sql`SELECT * FROM policy_fund_cases WHERE id = ${id}`
  return row || null
}

export async function createCase(c) {
  await ensureSchema()
  const f = caseFields(c)
  const [row] = await sql`
    INSERT INTO policy_fund_cases
      (title, fund_key, institution, fund_name, industry, biz_age_years, sales, employees, credit_score,
       existing_loans, outcome, approved_amount, requested_amount, rejection_reason, case_date, region,
       lesson, details, tags, source, created_by)
    VALUES
      (${f.title}, ${f.fund_key}, ${f.institution}, ${f.fund_name}, ${f.industry}, ${f.biz_age_years}, ${f.sales}, ${f.employees}, ${f.credit_score},
       ${f.existing_loans}::jsonb, ${f.outcome}, ${f.approved_amount}, ${f.requested_amount}, ${f.rejection_reason}, ${f.case_date}, ${f.region},
       ${f.lesson}, ${f.details}, ${f.tags}::jsonb, ${f.source}, ${c.created_by ?? null})
    RETURNING *
  `
  return row
}

export async function updateCase(id, c) {
  await ensureSchema()
  const f = caseFields(c)
  const [row] = await sql`
    UPDATE policy_fund_cases SET
      title = ${f.title}, fund_key = ${f.fund_key}, institution = ${f.institution}, fund_name = ${f.fund_name},
      industry = ${f.industry}, biz_age_years = ${f.biz_age_years}, sales = ${f.sales}, employees = ${f.employees},
      credit_score = ${f.credit_score}, existing_loans = ${f.existing_loans}::jsonb, outcome = ${f.outcome},
      approved_amount = ${f.approved_amount}, requested_amount = ${f.requested_amount}, rejection_reason = ${f.rejection_reason},
      case_date = ${f.case_date}, region = ${f.region}, lesson = ${f.lesson}, details = ${f.details},
      tags = ${f.tags}::jsonb, source = ${f.source}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `
  return row || null
}

export async function deleteCase(id) {
  await ensureSchema()
  await sql`DELETE FROM policy_fund_cases WHERE id = ${id}`
}
