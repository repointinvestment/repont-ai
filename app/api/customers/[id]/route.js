// app/api/customers/[id]/route.js
import { sql } from '@/lib/db'
import { encrypt } from '@/lib/crypto'
import { upsertNamedCredential } from '@/lib/credentials'
import { ensureSchema as ensureRecheckSchema } from '@/lib/customerRecheckStore'
import { NextResponse } from 'next/server'

// 이 고객이 요청자 본인 담당(consultant_id 일치) 또는 관리자인지 확인 — 아니면 다른 컨설턴트가
// 고객 ID만 알면 남의 고객 정보를 보거나 고치거나 지울 수 있었던 구멍이라 반드시 필요.
async function checkOwnership(id, request) {
  const [row] = await sql`SELECT consultant_id FROM customers WHERE id = ${id}`
  if (!row) return { ok: false, status: 404, error: '고객을 찾을 수 없습니다.' }
  const username = request.headers.get('x-consultant-id')
  const role = request.headers.get('x-consultant-role')
  if (role !== 'admin' && String(row.consultant_id) !== String(username)) {
    return { ok: false, status: 403, error: '본인이 담당하는 고객만 접근할 수 있습니다.' }
  }
  return { ok: true }
}

// 고객 1명 상세 조회
export async function GET(request, { params }) {
  const { id } = params
  const check = await checkOwnership(id, request)
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status })
  const rows = await sql`SELECT * FROM customers WHERE id = ${id}`
  return NextResponse.json({ customer: rows[0] })
}

// 계정정보(주민등록번호/공동인증서 비밀번호) 추가 또는 갱신.
// 값을 입력한 경우에만 반영: 같은 종류가 이미 있으면 새 값으로 교체, 없으면 새로 추가.
async function upsertCredential(customerId, serviceName, plainValue) {
  if (!plainValue) return
  const encrypted = encrypt(plainValue)
  const existing = await sql`
    SELECT id FROM customer_credentials
    WHERE customer_id = ${customerId} AND service_name = ${serviceName}
  `
  if (existing.length > 0) {
    await sql`
      UPDATE customer_credentials SET password_encrypted = ${encrypted}
      WHERE id = ${existing[0].id}
    `
  } else {
    await sql`
      INSERT INTO customer_credentials (customer_id, service_name, username, password_encrypted)
      VALUES (${customerId}, ${serviceName}, '', ${encrypted})
    `
  }
}

// 빈칸/공백 문자열을 null로 바꿔줌 — 숫자·날짜 컬럼에 ''가 그대로 들어가면
// Postgres가 "invalid input syntax for type integer/date: ''" 에러를 던짐.
function blankToNull(v) {
  if (v === undefined || v === null) return null
  if (typeof v === 'string' && v.trim() === '') return null
  return v
}

// 고객 정보 수정
export async function PATCH(request, { params }) {
  const { id } = params
  const check = await checkOwnership(id, request)
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status })
  const body = await request.json()
  await ensureRecheckSchema()

  const [before] = await sql`SELECT status, marketing_consent, marketing_consent_at FROM customers WHERE id = ${id}`
  const nextConsentAt = body.marketingConsent
    ? (before?.marketing_consent ? before.marketing_consent_at : new Date().toISOString())
    : null

  const [customer] = await sql`
    UPDATE customers SET
      business_name = ${blankToNull(body.businessName)},
      business_type = ${blankToNull(body.businessType)},
      owner_name = ${blankToNull(body.ownerName)},
      phone = ${blankToNull(body.phone)},
      email = ${blankToNull(body.email)},
      biz_reg_number = ${blankToNull(body.bizRegNumber)},
      establish_date = ${blankToNull(body.establishDate)},
      open_date = ${blankToNull(body.openDate)},
      address = ${blankToNull(body.address)},
      industry = ${blankToNull(body.industry)},
      business_content = ${blankToNull(body.businessContent)},
      employee_count = ${blankToNull(body.employeeCount) ?? 0},
      last_year_sales = ${blankToNull(body.lastYearSales)},
      credit_nice = ${blankToNull(body.creditNice)},
      credit_kcb = ${blankToNull(body.creditKcb)},
      revenue_amount = ${blankToNull(body.revenueAmount)},
      address_ownership = ${blankToNull(body.addressOwnership)},
      residence_address = ${blankToNull(body.residenceAddress)},
      residence_ownership = ${blankToNull(body.residenceOwnership)},
      loan_status = ${blankToNull(body.loanStatus)},
      memo = ${blankToNull(body.memo)},
      status = ${body.status},
      has_patent = ${!!body.hasPatent},
      has_yellow_umbrella = ${!!body.hasYellowUmbrella},
      has_rnd_center = ${!!body.hasRndCenter},
      has_venture_cert = ${!!body.hasVentureCert},
      owner_career_years = ${blankToNull(body.ownerCareerYears)},
      has_woman_biz_cert = ${!!body.hasWomanBizCert},
      has_sojinkong_good_repayment = ${!!body.hasSojinkongGoodRepayment},
      business_age_years = ${blankToNull(body.businessAgeYears)},
      policy_fund_details = ${JSON.stringify(body.policyFundDetails || {})},
      marketing_consent = ${!!body.marketingConsent},
      marketing_consent_at = ${nextConsentAt},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `

  // 메타 양식에서 '소식 알림 신청: 예'를 확인한 경우에만 신청 처리 (이미 신청된 고객의 기록은 덮어쓰지 않음)
  if (body.metaAlertSubscribed) {
    await sql`
      UPDATE customers SET alert_subscribed_at = NOW(), alert_source = 'meta_lead'
      WHERE id = ${id} AND alert_subscribed_at IS NULL
    `
  }

  if (!customer) {
    return NextResponse.json({ error: '고객을 찾을 수 없습니다.' }, { status: 404 })
  }

  const newStatus = body.status || '상담중'
  if (!before || before.status !== newStatus) {
    await sql`
      INSERT INTO customer_status_history (customer_id, status)
      VALUES (${id}, ${newStatus})
    `
  }

  await upsertCredential(id, '주민등록번호', body.residentNumber)
  await upsertCredential(id, '공동인증서 비밀번호', body.certPassword)

  if (Array.isArray(body.additionalCredentials)) {
    for (const cred of body.additionalCredentials) {
      await upsertNamedCredential(id, cred.serviceName, cred.username, cred.password, cred.secondaryPassword)
    }
  }

  return NextResponse.json({ customer })
}

// 고객 삭제
export async function DELETE(request, { params }) {
  const { id } = params
  const check = await checkOwnership(id, request)
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status })
  await sql`DELETE FROM customer_credentials WHERE customer_id = ${id}`
  await sql`DELETE FROM customers WHERE id = ${id}`
  return NextResponse.json({ success: true })
}
