// app/api/customers/route.js
// 담당 컨설턴트 본인 고객만 조회. role='admin'이면 전체 조회.
import { sql } from '@/lib/db'
import { encrypt } from '@/lib/crypto'
import { ensureSchema as ensureRecheckSchema } from '@/lib/customerRecheckStore'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const consultantId = request.headers.get('x-consultant-id')
  const role = request.headers.get('x-consultant-role')

  // consultantId 헤더가 없으면 무조건 거부 — 예전엔 이 경우를 "전체 조회 허용"으로 잘못 처리해서,
  // 로그인 헤더를 안 보내기만 하면 아무나 전체 고객(주민등록번호 등 민감정보 포함) 목록을 볼 수 있는
  // 구멍이 있었음. business-plans에서 찾았던 것과 똑같은 패턴의 버그였음.
  if (!consultantId) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const rows = role === 'admin'
    ? await sql`
        SELECT c.*, h.first_consulted_at
        FROM customers c
        LEFT JOIN (
          SELECT customer_id, MIN(changed_at) AS first_consulted_at
          FROM customer_status_history
          GROUP BY customer_id
        ) h ON h.customer_id = c.id
        ORDER BY c.updated_at DESC
      `
    : await sql`
        SELECT c.*, h.first_consulted_at
        FROM customers c
        LEFT JOIN (
          SELECT customer_id, MIN(changed_at) AS first_consulted_at
          FROM customer_status_history
          GROUP BY customer_id
        ) h ON h.customer_id = c.id
        WHERE c.consultant_id = ${consultantId}
        ORDER BY c.updated_at DESC
      `
  return NextResponse.json({ customers: rows })
}

export async function POST(request) {
  await ensureRecheckSchema()
  const rawConsultantId = request.headers.get('x-consultant-id')
  const consultantId = rawConsultantId ? rawConsultantId : null
  const body = await request.json()

  try {
    const [customer] = await sql`
      INSERT INTO customers (
        consultant_id, business_name, business_type, owner_name, phone, email,
        biz_reg_number, establish_date, open_date, address, industry,
        business_content, employee_count, last_year_sales, credit_nice, credit_kcb,
        revenue_amount, address_ownership, residence_address, residence_ownership,
        loan_status, memo, has_patent, has_yellow_umbrella, has_rnd_center, has_venture_cert, owner_career_years,
        has_woman_biz_cert, has_sojinkong_good_repayment, business_age_years, policy_fund_details, status,
        marketing_consent, marketing_consent_at
      ) VALUES (
        ${consultantId}, ${body.businessName}, ${body.businessType}, ${body.ownerName}, ${body.phone}, ${body.email},
        ${body.bizRegNumber}, ${body.establishDate}, ${body.openDate}, ${body.address}, ${body.industry},
        ${body.businessContent}, ${body.employeeCount || 0}, ${body.lastYearSales}, ${body.creditNice}, ${body.creditKcb},
        ${body.revenueAmount}, ${body.addressOwnership}, ${body.residenceAddress}, ${body.residenceOwnership},
        ${body.loanStatus}, ${body.memo}, ${!!body.hasPatent}, ${!!body.hasYellowUmbrella}, ${!!body.hasRndCenter}, ${!!body.hasVentureCert}, ${body.ownerCareerYears || null},
        ${!!body.hasWomanBizCert}, ${!!body.hasSojinkongGoodRepayment}, ${body.businessAgeYears || null}, ${JSON.stringify(body.policyFundDetails || {})}, ${body.status || '상담중'},
        ${!!body.marketingConsent}, ${body.marketingConsent ? new Date().toISOString() : null}
      )
      RETURNING *
    `

    // 진행 단계 이력 첫 기록
    await sql`
      INSERT INTO customer_status_history (customer_id, status)
      VALUES (${customer.id}, ${customer.status || '상담중'})
    `

    // 주민등록번호 / 공동인증서 비밀번호는 암호화해서 customer_credentials에 별도 저장
    if (body.residentNumber) {
      const encrypted = encrypt(body.residentNumber)
      await sql`
        INSERT INTO customer_credentials (customer_id, service_name, username, password_encrypted)
        VALUES (${customer.id}, '주민등록번호', '', ${encrypted})
      `
    }
    if (body.certPassword) {
      const encrypted = encrypt(body.certPassword)
      await sql`
        INSERT INTO customer_credentials (customer_id, service_name, username, password_encrypted)
        VALUES (${customer.id}, '공동인증서 비밀번호', '', ${encrypted})
      `
    }

    // 소진공, 홈택스 등 자유롭게 추가한 계정 정보
    if (Array.isArray(body.additionalCredentials)) {
      for (const cred of body.additionalCredentials) {
        if (!cred.serviceName) continue
        const encrypted = cred.password ? encrypt(cred.password) : ''
        const secondaryEncrypted = cred.secondaryPassword ? encrypt(cred.secondaryPassword) : null
        await sql`
          INSERT INTO customer_credentials (customer_id, service_name, username, password_encrypted, secondary_password_encrypted)
          VALUES (${customer.id}, ${cred.serviceName}, ${cred.username || ''}, ${encrypted}, ${secondaryEncrypted})
        `
      }
    }

    return NextResponse.json({ customer })
  } catch (err) {
    console.error('고객 등록 실패:', err)
    return NextResponse.json({ error: err.message || '등록 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
