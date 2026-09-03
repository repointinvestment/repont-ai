// lib/contractsStore.js
// 컨설턴트가 "자기 고객"과 맺는 정책자금 컨설팅 서비스 계약 — 계약서 생성 + 전자서명(고객이 대면으로
// 컨설턴트 화면에서 직접 서명) + 입금확인 + 만료 리마인더.
// 대표(admin)와 컨설턴트 사이의 계약이 아님 — 그건 애초에 필요 없다고 확인됨. 대표는 전체 현황만
// 조회 가능(생성/서명/입금확인은 각 컨설턴트가 자기 고객 건만 처리).

import { sql } from '@/lib/db'

let schemaReady = false

export const FEE_STRUCTURES = [
  { key: 'flat', label: '정액만' },
  { key: 'flat_plus_success', label: '정액 + 자금 실행 시 성공보수 5%' },
]
export const CONTRACT_STATUSES = ['서명대기', '서명완료', '입금확인', '만료', '해지']
const CONTRACT_TERM_DAYS = 365

export async function ensureSchema() {
  if (schemaReady) return
  await sql`
    CREATE TABLE IF NOT EXISTS contracts (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
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
  // 예전(대표↔컨설턴트 계약) 버전에서 이미 만들어졌을 수 있는 테이블을 새 구조(고객 대상)로 전환.
  // 실제 계약 건이 없었던 상태라 데이터 손실 걱정 없이 컬럼만 추가/정리.
  await sql`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE`
  await sql`ALTER TABLE contracts ALTER COLUMN status SET DEFAULT '서명대기'`
  await sql`CREATE INDEX IF NOT EXISTS idx_contracts_customer ON contracts(customer_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_contracts_consultant ON contracts(consultant_username)`
  await sql`CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status)`
  schemaReady = true
}

function buildContractText({ consultantName, customerName, businessName, feeAmount, feeStructure, successFeePct }) {
  const feeLine = feeStructure === 'flat_plus_success'
    ? `연회비 ${feeAmount.toLocaleString()}원(정액) + 정책자금 실행 성공 시 실행금액의 ${successFeePct || 5}%를 성공보수로 지급`
    : `연회비 ${feeAmount.toLocaleString()}원(정액, 성공보수 없음)`

  return `정책자금 컨설팅 서비스 계약서

제1조 (계약 당사자)
"갑" ${consultantName}(이하 "갑")과 "을" ${customerName}${businessName ? `(${businessName})` : ''}(이하 "을")은 아래와 같이 정책자금 컨설팅 서비스 계약을 체결한다.

제2조 (계약 목적)
갑은 을에게 정책자금 자격 진단, 서류 준비, 신청·접수 지원 등 정책자금 컨설팅 서비스를 제공한다.

제3조 (계약 기간)
본 계약의 기간은 계약 체결일로부터 1년(365일)로 하며, 별도 해지 의사 표시가 없는 한 자동 갱신되지 않고 만료일에 종료된다.

제4조 (컨설팅 비용)
${feeLine}

제5조 (갑의 의무)
갑은 을의 개인정보 및 사업 정보를 선량한 관리자의 주의 의무로 보호하며, 정책자금 컨설팅 업무를 성실히 수행한다.

제6조 (계약의 해지)
갑 또는 을은 상대방에게 서면(전자문서 포함) 통지로 본 계약을 해지할 수 있다.

본 계약은 을이 아래에 전자서명함으로써 효력이 발생한다.`
}

// consultantUsername이 있으면 그 컨설턴트가 만든 것만(자기 고객 건), 없으면 전체(관리자 조회용).
export async function listContracts({ consultantUsername = null } = {}) {
  await ensureSchema()
  return consultantUsername
    ? sql`
        SELECT ct.*, c.owner_name, c.business_name
        FROM contracts ct LEFT JOIN customers c ON c.id = ct.customer_id
        WHERE ct.consultant_username = ${consultantUsername}
        ORDER BY (ct.status = '서명대기') DESC, ct.created_at DESC`
    : sql`
        SELECT ct.*, c.owner_name, c.business_name
        FROM contracts ct LEFT JOIN customers c ON c.id = ct.customer_id
        ORDER BY (ct.status = '서명대기') DESC, ct.created_at DESC`
}

export async function listContractsForCustomer(customerId) {
  await ensureSchema()
  return sql`SELECT * FROM contracts WHERE customer_id = ${customerId} ORDER BY created_at DESC`
}

export async function getContract(id) {
  await ensureSchema()
  const [row] = await sql`SELECT * FROM contracts WHERE id = ${id}`
  return row || null
}

export async function createContract({ customerId, customerName, businessName, consultantUsername, consultantName, feeAmount, feeStructure, successFeePct }) {
  await ensureSchema()
  const amount = feeAmount || 1000000
  const content = buildContractText({ consultantName, customerName, businessName, feeAmount: amount, feeStructure, successFeePct })
  const [row] = await sql`
    INSERT INTO contracts (customer_id, consultant_username, consultant_name, fee_amount, fee_structure, success_fee_pct, content, created_by)
    VALUES (${customerId}, ${consultantUsername}, ${consultantName || null}, ${amount}, ${feeStructure || 'flat'}, ${feeStructure === 'flat_plus_success' ? (successFeePct || 5) : null}, ${content}, ${consultantUsername || null})
    RETURNING *
  `
  return row
}

// 고객이 컨설턴트 화면(태블릿/노트북)에서 대면으로 직접 서명 — signedName은 고객 본인 이름.
export async function signContract(id, { signatureData, signedName }) {
  await ensureSchema()
  const [row] = await sql`
    UPDATE contracts SET
      signature_data = ${signatureData}, signed_name = ${signedName}, signed_at = NOW(),
      status = '서명완료', updated_at = NOW()
    WHERE id = ${id} AND status = '서명대기'
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

export async function deleteContract(id) {
  await ensureSchema()
  await sql`DELETE FROM contracts WHERE id = ${id}`
}

// 만료 30일 이내(또는 이미 지남) + 아직 '입금확인'(=활성) 상태인 계약
export async function listExpiringSoon({ withinDays = 30 } = {}) {
  await ensureSchema()
  return sql`
    SELECT ct.*, c.owner_name, c.business_name
    FROM contracts ct LEFT JOIN customers c ON c.id = ct.customer_id
    WHERE ct.status = '입금확인'
      AND ct.end_date IS NOT NULL
      AND ct.end_date <= (CURRENT_DATE + (${withinDays}::text || ' days')::interval)
    ORDER BY ct.end_date ASC
  `
}
