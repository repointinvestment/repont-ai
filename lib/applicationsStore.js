// lib/applicationsStore.js
// 파이프라인(상담→서류수집→신청→심사→승인/부결) 저장소.
// 로드맵 3번: 재단은 재신청 제한기간이 있어 날짜 리마인더, 소진공은 제한기간 없고 공고 시점을 모르니
// '대기' 상태로 두고 (나중에) 공고 알림과 연결해 재신청 알림.
//
// 한 고객이 같은 자금에 여러 번(부결→재신청) 도전할 수 있으므로 이력은 fund_applications 여러 행 +
// fund_application_events(상태 변경 타임라인)로 관리. ensureSchema()가 처음 호출될 때 테이블을 자동 생성.

import { sql } from '@/lib/db'
import { listFunds } from '@/lib/policyFundsStore'

let schemaReady = false

export const STAGES = ['상담', '서류수집', '신청', '심사중', '승인', '부결', '보류']

export async function ensureSchema() {
  if (schemaReady) return
  await sql`
    CREATE TABLE IF NOT EXISTS fund_applications (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      fund_key TEXT,
      fund_name TEXT NOT NULL,
      institution TEXT,
      stage TEXT NOT NULL DEFAULT '상담',
      requested_amount INTEGER,
      approved_amount INTEGER,
      submitted_at DATE,
      decided_at DATE,
      rejection_reason TEXT,
      reapply_rule_type TEXT,
      reapply_available_at DATE,
      reapply_status TEXT DEFAULT 'not_applicable',
      notes TEXT,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS fund_application_events (
      id SERIAL PRIMARY KEY,
      application_id INTEGER NOT NULL REFERENCES fund_applications(id) ON DELETE CASCADE,
      stage TEXT NOT NULL,
      note TEXT,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_fund_applications_customer ON fund_applications(customer_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_fund_applications_reapply ON fund_applications(reapply_status, reapply_available_at)`
  schemaReady = true
}

// reapply_rule(마스터 DB) + 부결일 → 재신청 가능일/상태 계산.
// months / months_by_region: 날짜 계산 가능 → 'waiting'(날짜 전) or 'ready'(날짜 지남)
// announcement: 날짜를 모름 → 'waiting_for_announcement' (다음 공고 알림 기능과 연결 예정)
// none/미확정: 'not_applicable'
function computeReapply(reapplyRule, region, decidedAt) {
  const type = reapplyRule?.type
  if (!decidedAt || !type || type === 'none') return { type: type || null, availableAt: null, status: 'not_applicable' }
  if (type === 'announcement') return { type, availableAt: null, status: 'waiting_for_announcement' }
  if (type === 'months') {
    let months = reapplyRule.months
    if (reapplyRule.months_by_region) {
      months = region === '수도권' ? reapplyRule.months_by_region['수도권'] : reapplyRule.months_by_region['지방']
    }
    if (months == null) return { type, availableAt: null, status: 'not_applicable' }
    const d = new Date(decidedAt)
    d.setMonth(d.getMonth() + Number(months))
    const availableAt = d.toISOString().slice(0, 10)
    const status = new Date() >= d ? 'ready' : 'waiting'
    return { type, availableAt, status }
  }
  return { type, availableAt: null, status: 'not_applicable' }
}

export async function listApplications(customerId) {
  await ensureSchema()
  return sql`SELECT * FROM fund_applications WHERE customer_id = ${customerId} ORDER BY created_at DESC`
}

export async function getApplication(id) {
  await ensureSchema()
  const [row] = await sql`SELECT * FROM fund_applications WHERE id = ${id}`
  return row || null
}

export async function listEvents(applicationId) {
  await ensureSchema()
  return sql`SELECT * FROM fund_application_events WHERE application_id = ${applicationId} ORDER BY created_at ASC`
}

export async function createApplication(customerId, body, createdBy) {
  await ensureSchema()
  const [row] = await sql`
    INSERT INTO fund_applications
      (customer_id, fund_key, fund_name, institution, stage, requested_amount, submitted_at, notes, created_by)
    VALUES
      (${customerId}, ${body.fundKey || null}, ${body.fundName}, ${body.institution || null}, ${body.stage || '상담'},
       ${body.requestedAmount ?? null}, ${body.submittedAt || null}, ${body.notes || null}, ${createdBy || null})
    RETURNING *
  `
  await sql`INSERT INTO fund_application_events (application_id, stage, note, created_by) VALUES (${row.id}, ${row.stage}, ${'접수 생성'}, ${createdBy || null})`
  return row
}

// 단계 변경(및 부결 시 사유·재신청일 계산)을 한 번에 처리.
export async function updateStage(id, { stage, decidedAt, rejectionReason, approvedAmount, note, region }, updatedBy) {
  await ensureSchema()
  const app = await getApplication(id)
  if (!app) return null

  let reapply = { type: app.reapply_rule_type, availableAt: app.reapply_available_at, status: app.reapply_status }
  if (stage === '부결') {
    const decided = decidedAt || new Date().toISOString().slice(0, 10)
    let rule = null
    if (app.fund_key) {
      const funds = await listFunds({ activeOnly: false })
      const f = funds.find((x) => x.key === app.fund_key)
      rule = f?.reapply_rule || null
    }
    const computed = computeReapply(rule, region, decided)
    reapply = { type: computed.type, availableAt: computed.availableAt, status: computed.status }
  }

  const [row] = await sql`
    UPDATE fund_applications SET
      stage = ${stage},
      decided_at = ${stage === '부결' || stage === '승인' ? (decidedAt || new Date().toISOString().slice(0, 10)) : app.decided_at},
      rejection_reason = ${stage === '부결' ? (rejectionReason || null) : app.rejection_reason},
      approved_amount = ${stage === '승인' ? (approvedAmount ?? app.approved_amount) : app.approved_amount},
      reapply_rule_type = ${reapply.type},
      reapply_available_at = ${reapply.availableAt},
      reapply_status = ${reapply.status},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `
  await sql`INSERT INTO fund_application_events (application_id, stage, note, created_by) VALUES (${id}, ${stage}, ${note || null}, ${updatedBy || null})`
  return row
}

export async function updateApplication(id, body) {
  await ensureSchema()
  const [row] = await sql`
    UPDATE fund_applications SET
      requested_amount = COALESCE(${body.requestedAmount ?? null}, requested_amount),
      submitted_at = COALESCE(${body.submittedAt || null}, submitted_at),
      notes = COALESCE(${body.notes ?? null}, notes),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `
  return row || null
}

export async function deleteApplication(id) {
  await ensureSchema()
  await sql`DELETE FROM fund_applications WHERE id = ${id}`
}

// '재신청 가능' 시점이 된(reapply_status='ready') 또는 기한이 임박한 부결 건 전체를 고객 정보와 함께.
// 메인메뉴 위젯 + 전체 리마인더 화면에서 사용.
export async function listReapplyReminders({ withinDays = 14 } = {}) {
  await ensureSchema()
  const rows = await sql`
    SELECT a.*, c.owner_name, c.business_name
    FROM fund_applications a
    JOIN customers c ON c.id = a.customer_id
    WHERE a.stage = '부결'
      AND a.reapply_status IN ('ready', 'waiting')
      AND (a.reapply_available_at IS NULL OR a.reapply_available_at <= (CURRENT_DATE + (${withinDays}::text || ' days')::interval))
    ORDER BY (a.reapply_status = 'ready') DESC, a.reapply_available_at ASC NULLS LAST
  `
  return rows
}

// 소진공처럼 '공고 기준' 부결 건 — 공고 알림 기능(로드맵 6번) 완성 전까지는 그냥 목록으로.
export async function listAwaitingAnnouncement() {
  await ensureSchema()
  return sql`
    SELECT a.*, c.owner_name, c.business_name
    FROM fund_applications a
    JOIN customers c ON c.id = a.customer_id
    WHERE a.stage = '부결' AND a.reapply_status = 'waiting_for_announcement'
    ORDER BY a.decided_at DESC
  `
}
