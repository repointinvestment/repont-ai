// app/api/trial/signup/route.js
// 웨비나 체험 이용권 가입(공개 API). 입장코드를 아는 사람만, 관리자가 정한 기간(기본 7일)짜리 체험 계정을 직접 만듭니다.
// 방어: 입장코드 + 총 가입 상한 + IP당 시간당 가입 제한 + 체험 계정은 허용 목록 API만 사용 가능(middleware.js).
import { sql } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'
import { ensureAccountsSchema } from '@/lib/accountsStore'

export const dynamic = 'force-dynamic'

const DEMO_PFD = {
  sojingongLoans: { sinYong: '', hyuksin: '', jaedo: '', ilsi: '', etc: '' },
  loans: {}, hasBankruptcy: 'no', currentBizCount: '1', smartDevices: ['포스기'],
  exportRecord: 'no', salesGrowth: 'no', taxDelinquent: 'no', isFranchise: false,
}

export async function POST(request) {
  await ensureAccountsSchema()
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
  const { code, name, username, password } = await request.json()

  const [cfg] = await sql`SELECT * FROM trial_config WHERE id = 1`
  if (!cfg || !cfg.active || !cfg.code) {
    return NextResponse.json({ error: '지금은 체험 이용권 신청 기간이 아닙니다.' }, { status: 403 })
  }
  if (String(code || '').trim().toLowerCase() !== String(cfg.code).trim().toLowerCase()) {
    return NextResponse.json({ error: '입장코드가 올바르지 않습니다.' }, { status: 403 })
  }
  if (!name || String(name).trim().length < 2 || String(name).length > 30) {
    return NextResponse.json({ error: '이름을 입력해주세요.' }, { status: 400 })
  }
  if (!/^[a-z0-9_]{4,20}$/.test(username || '')) {
    return NextResponse.json({ error: '아이디는 영문 소문자·숫자·밑줄 4~20자로 입력해주세요.' }, { status: 400 })
  }
  if (!password || String(password).length < 8 || String(password).length > 64) {
    return NextResponse.json({ error: '비밀번호는 8자 이상으로 입력해주세요.' }, { status: 400 })
  }

  // IP당 1시간에 5건까지(로그인 시도 테이블을 재활용하지 않고 계정 생성 기록으로 판단하기 위해 별도 집계)
  const [{ n: recentByIp }] = await sql`
    SELECT COUNT(*)::int AS n FROM login_attempts WHERE ip = ${ip} AND username LIKE 'signup:%' AND created_at > NOW() - INTERVAL '1 hour'
  `
  if (recentByIp >= 5) {
    return NextResponse.json({ error: '짧은 시간에 너무 많이 신청했습니다. 잠시 후 다시 시도해주세요.' }, { status: 429 })
  }

  const [{ n: total }] = await sql`SELECT COUNT(*)::int AS n FROM accounts WHERE role = 'trial' AND trial_code = ${cfg.code}`
  if (total >= cfg.max_signups) {
    return NextResponse.json({ error: '이번 체험 이용권은 마감되었습니다.' }, { status: 403 })
  }

  const [exists] = await sql`SELECT id FROM accounts WHERE username = ${username}`
  if (exists) {
    return NextResponse.json({ error: '이미 사용 중인 아이디입니다. 다른 아이디를 입력해주세요.' }, { status: 409 })
  }

  const days = Math.max(1, Math.min(60, Number(cfg.days) || 7))
  const expiresAt = new Date(Date.now() + days * 86400000)
  const passwordHash = bcrypt.hashSync(password, 10)

  try {
    await sql`
      INSERT INTO accounts (username, password_hash, name, role, expires_at, trial_code)
      VALUES (${username}, ${passwordHash}, ${String(name).trim()}, 'trial', ${expiresAt.toISOString()}, ${cfg.code})
    `
    await sql`INSERT INTO login_attempts (ip, username, success) VALUES (${ip}, ${'signup:' + username}, TRUE)`

    // 로그인하자마자 기능을 체험할 수 있게 가상의 예시 고객 2명을 채워줌
    await sql`
      INSERT INTO customers (
        consultant_id, business_name, owner_name, phone, email, industry, business_content,
        employee_count, revenue_amount, credit_nice, credit_kcb, business_age_years,
        policy_fund_details, status, address, address_ownership
      ) VALUES
      (${username}, '예시상사', '김예시', '010-0000-0001', 'sample1@example.com', '도소매업', '생활용품 온라인·오프라인 판매',
       2, 8000, 780, 750, 3, ${JSON.stringify(DEMO_PFD)}, '상담중', '부산광역시 강서구 예시로 1', '임대'),
      (${username}, '예시카페', '이샘플', '010-0000-0002', 'sample2@example.com', '음식점·카페 (요식업)', '스페셜티 커피 전문점',
       1, 4500, 720, 700, 1, ${JSON.stringify(DEMO_PFD)}, '서류준비', '부산광역시 해운대구 예시길 22', '임대')
    `
  } catch (err) {
    console.error('체험 계정 생성 실패:', err)
    // 계정만 생기고 예시 고객 입력이 실패한 경우 아이디가 잠기지 않도록 정리
    await sql`DELETE FROM accounts WHERE username = ${username} AND role = 'trial'`.catch(() => {})
    return NextResponse.json({ error: '계정 생성 중 오류가 발생했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, expiresAt: expiresAt.toISOString(), days })
}
