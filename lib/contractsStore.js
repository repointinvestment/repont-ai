// lib/contractsStore.js
// 100만원 연간계약 도구 — 계약서 템플릿 생성 + 전자서명 + 입금확인 + 만료 리마인더.
// 수수료 구조는 사용자가 계약 생성 시점에 선택: 정액만(flat) / 정액+자금 실행 시 성공보수 5%(flat_plus_success).

import { sql } from '@/lib/db'

let schemaReady = false

export const FEE_STRUCTURES = [
  { key: 'flat', label: '정액만' },
  { key: 'flat_plus_success', label: '정액 + 자금 실행 시 성공보수 5%' },
]
export const CONTRACT_STATUSES = ['발송', '서명완료', '입금확인', '만료', '해지']
const CONTRACT_TERM_DAYS = 365

export async function ensureSchema() {
  if (schemaReady) return
  await sql`
    CREATE TABLE IF NOT EXISTS contracts (
      id SERIAL PRIMARY KEY,
      consultant_username TEXT NOT NULL,
      consultant_name TEXT,
      fee_amount INTEGER NOT NULL DEFAULT 1000000,
      fee_structure TEXT NOT NULL DEFAULT 'flat',
      success_fee_pct NUMERIC,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT '발송',
      signature_data TEXT,
      signed_name TEXT,
      signed_at TIMESTAMPTZ,
      payment_confirmed_at TIMESTAMPTZ,
      payment_confirmed_by TEXT,
      start_date DATE,
      end_date DATE,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_contracts_consultant ON contracts(consultant_username)`
  await sql`CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status)`
  schemaReady = true
}

function buildContractText({ consultantName, feeAmount, feeStructure, successFeePct }) {
  const feeLine = feeStructure === 'flat_plus_success'
    ? `연회비 ${feeAmount.toLocaleString()}원(정액) + 정책자금 실행 성공 시 실행금액의 ${successFeePct || 5}%를 성공보수로 지급`
    : `연회비 ${feeAmount.toLocaleString()}원(정액, 성공보수 없음)`

  return `자금비서(정책자금 컨설팅 툴) 이용 계약서

제1조 (계약 당사자)
"갑" 리포인트파트너스(이하 "갑")와 "을" ${consultantName}(이하 "을")은 아래와 같이 자금비서 툴 이용 및 정책자금 컨설팅 업무 위탁에 관한 계약을 체결한다.

제2조 (계약 목적)
갑은 을에게 정책자금 컨설팅 업무 수행에 필요한 자금비서 툴(고객관리, 정책자금 자격판정, 서류발급 연동, AI 상담 등) 이용 권한을 제공하고, 을은 이를 이용하여 정책자금 컨설팅 업무를 수행한다.

제3조 (이용 기간)
본 계약의 이용 기간은 계약 체결일로부터 1년(365일)로 하며, 별도 해지 의사 표시가 없는 한 자동 갱신되지 않고 만료일에 종료된다.

제4조 (이용료)
${feeLine}

제5조 (을의 의무)
을은 자금비서 툴을 통해 취급하게 되는 고객의 개인정보 및 사업 정보를 선량한 관리자의 주의 의무로 보호하며, 정책자금 컨설팅 업무를 성실히 수행한다.

제6조 (계약의 해지)
갑 또는 을은 상대방에게 서면(전자문서 포함) 통지로 본 계약을 해지할 수 있다.

본 계약은 을이 아래에 전자서명함으로써 효력이 발생한다.`
}

export async function listContracts({ username = null } = {}) {
  await ensureSchema()
  return username
    ? sql`SELECT * FROM contracts WHERE consultant_username = ${username} ORDER BY created_at DESC`
    : sql`SELECT * FROM contracts ORDER BY (status = '발송') DESC, created_at DESC`
}

export async function getContract(id) {
  await ensureSchema()
  const [row] = await sql`SELECT * FROM contracts WHERE id = ${id}`
  return row || null
}

export async function createContract({ consultantUsername, consultantName, feeAmount, feeStructure, successFeePct }, createdBy) {
  await ensureSchema()
  const amount = feeAmount || 1000000
  const content = buildContractText({ consultantName, feeAmount: amount, feeStructure, successFeePct })
  const [row] = await sql`
    INSERT INTO contracts (consultant_username, consultant_name, fee_amount, fee_structure, success_fee_pct, content, created_by)
    VALUES (${consultantUsername}, ${consultantName || null}, ${amount}, ${feeStructure || 'flat'}, ${feeStructure === 'flat_plus_success' ? (successFeePct || 5) : null}, ${content}, ${createdBy || null})
    RETURNING *
  `
  return row
}

export async function signContract(id, { signatureData, signedName }) {
  await ensureSchema()
  const [row] = await sql`
    UPDATE contracts SET
      signature_data = ${signatureData}, signed_name = ${signedName}, signed_at = NOW(),
      status = '서명완료', updated_at = NOW()
    WHERE id = ${id} AND status = '발송'
    RETURNING *
  `
  return row || null
}

export async function confirmPayment(id, confirmedBy) {
  await ensureSchema()
  const start = new Date()
  const end = new Date(start)
  end.setDate(end.getDate() + CONTRACT_TERM_DAYS)
  const [row] = await sql`
    UPDATE contracts SET
      payment_confirmed_at = NOW(), payment_confirmed_by = ${confirmedBy || null},
      start_date = ${start.toISOString().slice(0, 10)}, end_date = ${end.toISOString().slice(0, 10)},
      status = '입금확인', updated_at = NOW()
    WHERE id = ${id} AND status = '서명완료'
    RETURNING *
  `
  return row || null
}

export async function updateStatus(id, status) {
  await ensureSchema()
  const [row] = await sql`UPDATE contracts SET status = ${status}, updated_at = NOW() WHERE id = ${id} RETURNING *`
  return row || null
}

// 만료 30일 이내(또는 이미 지남) + 아직 '만료' 처리 안 된 활성 계약
export async function listExpiringSoon({ withinDays = 30 } = {}) {
  await ensureSchema()
  return sql`
    SELECT * FROM contracts
    WHERE status = '입금확인'
      AND end_date IS NOT NULL
      AND end_date <= (CURRENT_DATE + (${withinDays}::text || ' days')::interval)
    ORDER BY end_date ASC
  `
}
