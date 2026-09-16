// app/api/admin/seed-demo/route.js
// 외부 사람한테 보여줄 데모 계정 만들기(1회성, 관리자 전용) — 실제 고객 데이터는 절대 안 넣고,
// 가짜 예시 고객 2명만 채워서 로그인하면 진단·CRM 기능이 바로 작동하는 걸 보여줄 수 있게 함.
// 여러 번 눌러도 안전(이미 있으면 비밀번호만 재설정하고 고객은 중복 안 만듦).

import { sql } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const DEMO_USERNAME = 'demo'
const DEMO_PASSWORD = 'demo1234!'

export async function POST(request) {
  if (request.headers.get('x-consultant-role') !== 'admin') {
    return NextResponse.json({ error: '관리자만 실행할 수 있습니다.' }, { status: 403 })
  }

  try {
    const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10)
    const [existing] = await sql`SELECT username FROM accounts WHERE username = ${DEMO_USERNAME}`

    if (existing) {
      await sql`UPDATE accounts SET password_hash = ${passwordHash} WHERE username = ${DEMO_USERNAME}`
    } else {
      await sql`INSERT INTO accounts (username, password_hash, name, role) VALUES (${DEMO_USERNAME}, ${passwordHash}, '데모 계정', 'consultant')`
    }

    const [existingCustomers] = await sql`SELECT COUNT(*)::int AS count FROM customers WHERE consultant_id = ${DEMO_USERNAME}`
    if (existingCustomers.count === 0) {
      const demoPfd = {
        sojingongLoans: { sinYong: '', hyuksin: '', jaedo: '', ilsi: '', etc: '' },
        loans: {}, hasBankruptcy: 'no', currentBizCount: '1', smartDevices: ['포스기'],
        exportRecord: 'no', salesGrowth: 'no', taxDelinquent: 'no', isFranchise: false,
      }
      await sql`
        INSERT INTO customers (
          consultant_id, business_name, owner_name, phone, email, industry, business_content,
          employee_count, revenue_amount, credit_nice, credit_kcb, business_age_years,
          policy_fund_details, status, address, address_ownership
        ) VALUES
        (${DEMO_USERNAME}, '데모상사', '김데모', '010-1234-5678', 'demo1@example.com', '도소매업', '생활용품 온라인·오프라인 판매',
         2, 8000, 780, 750, 3,
         ${JSON.stringify(demoPfd)}, '상담중', '부산광역시 강서구 데모로 1', '임대'),
        (${DEMO_USERNAME}, '데모카페', '이샘플', '010-2345-6789', 'demo2@example.com', '음식점·카페 (요식업)', '스페셜티 커피 전문점',
         1, 4500, 720, 700, 1,
         ${JSON.stringify(demoPfd)}, '서류준비', '부산광역시 해운대구 데모길 22', '임대')
      `
    }

    // 실제로 저장이 됐는지 다시 조회해서 확인(성공했다고 응답했는데 실제로는 안 만들어진 경우 방지)
    const [check] = await sql`SELECT username FROM accounts WHERE username = ${DEMO_USERNAME}`
    if (!check) {
      return NextResponse.json({ error: '계정이 생성된 것처럼 보였지만 실제로 저장되지 않았습니다.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, username: DEMO_USERNAME, password: DEMO_PASSWORD })
  } catch (err) {
    console.error('데모 계정 생성 실패:', err)
    return NextResponse.json({ error: `실패: ${err.message}` }, { status: 500 })
  }
}
