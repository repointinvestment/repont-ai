// lib/accountsStore.js
// accounts 테이블 확장(체험 계정 만료일) + 로그인 시도 기록 + 체험 계정 설정/사용량 테이블.
import { sql } from '@/lib/db'

let ready = false
export async function ensureAccountsSchema() {
  if (ready) return
  await sql`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`
  await sql`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS trial_code TEXT`
  // 기존 accounts.role CHECK 제약이 ('admin','consultant','student')만 허용해서 'trial' 계정 생성이 막혔음 → 제약 교체
  await sql`ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_role_check`
  await sql`ALTER TABLE accounts ADD CONSTRAINT accounts_role_check CHECK (role IN ('admin', 'consultant', 'student', 'trial'))`
  await sql`
    CREATE TABLE IF NOT EXISTS login_attempts (
      id SERIAL PRIMARY KEY,
      ip TEXT,
      username TEXT,
      success BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS trial_config (
      id INTEGER PRIMARY KEY DEFAULT 1,
      code TEXT,
      max_signups INTEGER DEFAULT 300,
      days INTEGER DEFAULT 7,
      active BOOLEAN DEFAULT FALSE,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS ai_usage (
      username TEXT NOT NULL,
      kind TEXT NOT NULL,
      day DATE NOT NULL DEFAULT CURRENT_DATE,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (username, kind, day)
    )
  `
  ready = true
}

// 체험 계정의 AI 사용량 제한(OpenAI 비용 방어). 일반 계정(consultant/admin)은 제한 없음.
const TRIAL_LIMITS = { chat: 40, plan: 3 } // 하루 기준
export async function checkAndCountAiUsage(username, role, kind) {
  if (role !== 'trial') return { ok: true }
  await ensureAccountsSchema()
  const limit = TRIAL_LIMITS[kind] ?? 20
  const [row] = await sql`
    INSERT INTO ai_usage (username, kind, day, count) VALUES (${username}, ${kind}, CURRENT_DATE, 1)
    ON CONFLICT (username, kind, day) DO UPDATE SET count = ai_usage.count + 1
    RETURNING count
  `
  if (row.count > limit) {
    return { ok: false, error: `체험 계정은 하루 ${limit}회까지 사용할 수 있어요. 내일 다시 이용해주세요.` }
  }
  return { ok: true }
}
