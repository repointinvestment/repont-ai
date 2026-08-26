// app/api/customers/[id]/route.js
import { sql } from '@/lib/db'
import { encrypt } from '@/lib/crypto'
import { NextResponse } from 'next/server'

// 고객 1명 상세 조회
export async function GET(request, { params }) {
  const { id } = params
  const rows = await sql`SELECT * FROM customers WHERE id = ${id}`
  if (rows.length === 0) {
    return NextResponse.json({ error: '고객을 찾을 수 없습니다.' }, { status: 404 })
  }
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

// 소진공, 홈택스 등 서비스명을 자유롭게 지정하는 계정 정보. 아이디는 평문, 비밀번호(들)만 암호화.
// 비밀번호를 비워두고 저장하면 기존 비밀번호는 유지하고 아이디만 갱신.
async function upsertNamedCredential(customerId, serviceName, username, plainPassword, plainSecondaryPassword) {
  if (!serviceName) return
  const existing = await sql`
    SELECT id, password_encrypted, secondary_password_encrypted FROM customer_credentials
    WHERE customer_id = ${customerId} AND service_name = ${serviceName}
  `
  const encrypted = plainPassword ? encrypt(plainPassword) : (existing[0]?.password_encrypted || '')
  const secondaryEncrypted = plainSecondaryPassword
    ? encrypt(plainSecondaryPassword)
    : (existing[0]?.secondary_password_encrypted || null)
  if (existing.length > 0) {
    await sql`
      UPDATE customer_credentials SET username = ${username || ''}, password_encrypted = ${encrypted}, secondary_password_encrypted = ${secondaryEncrypted}
      WHERE id = ${existing[0].id}
    `
  } else {
    await sql`
      INSERT INTO customer_credentials (customer_id, service_name, username, password_encrypted, secondary_password_encrypted)
      VALUES (${customerId}, ${serviceName}, ${username || ''}, ${encrypted}, ${secondaryEncrypted})
    `
  }
}

// 고객 정보 수정
export async function PATCH(request, { params }) {
  const { id } = params
  const body = await request.json()

  const [customer] = await sql`
    UPDATE customers SET
      business_name = ${body.businessName},
      business_type = ${body.businessType},
      owner_name = ${body.ownerName},
      phone = ${body.phone},
      email = ${body.email},
      biz_reg_number = ${body.bizRegNumber},
      establish_date = ${body.establishDate},
      open_date = ${body.openDate},
      address = ${body.address},
      industry = ${body.industry},
      business_content = ${body.businessContent},
      employee_count = ${body.employeeCount || 0},
      last_year_sales = ${body.lastYearSales},
      credit_nice = ${body.creditNice},
      credit_kcb = ${body.creditKcb},
      revenue_amount = ${body.revenueAmount},
      address_ownership = ${body.addressOwnership},
      residence_address = ${body.residenceAddress},
      residence_ownership = ${body.residenceOwnership},
      loan_status = ${body.loanStatus},
      memo = ${body.memo},
      status = ${body.status},
      has_patent = ${!!body.hasPatent},
      has_yellow_umbrella = ${!!body.hasYellowUmbrella},
      has_rnd_center = ${!!body.hasRndCenter},
      has_venture_cert = ${!!body.hasVentureCert},
      owner_career_years = ${body.ownerCareerYears || null},
      has_woman_biz_cert = ${!!body.hasWomanBizCert},
      has_sojinkong_good_repayment = ${!!body.hasSojinkongGoodRepayment},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `

  if (!customer) {
    return NextResponse.json({ error: '고객을 찾을 수 없습니다.' }, { status: 404 })
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
  await sql`DELETE FROM customer_credentials WHERE customer_id = ${id}`
  await sql`DELETE FROM customers WHERE id = ${id}`
  return NextResponse.json({ success: true })
}
