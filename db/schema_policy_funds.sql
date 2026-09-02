-- db/schema_policy_funds.sql
-- 정책자금 마스터 DB (자금별 한도·자격조건·재신청 규칙·필요서류) + 공통 규칙.
--
-- ※ 이 파일은 참고용. 실제 테이블은 lib/policyFundsStore.js의 ensureSchema()가
--    API 첫 호출 시 자동으로 만들고, 비어있으면 lib/policyFundsSeed.js 내용으로 채움.
--    따라서 Neon SQL Editor에서 따로 실행할 필요 없음. (실행해도 IF NOT EXISTS라 안전)
--
-- 이후 수정은 /admin/policy-funds 관리자 화면에서. 시드 파일은 백업/참고용.

CREATE TABLE IF NOT EXISTS policy_funds (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,             -- 코드용 식별자 (예: sojinkong_hyuksin_general)
  name TEXT NOT NULL,                   -- 자금명
  institution TEXT,                     -- 기관 (소진공/재단/신보/기보/중진공/지자체)
  fund_type TEXT,                       -- 직접대출 / 보증 / 이차보전 / 기타
  limit_operating INTEGER,              -- 운전자금 한도 (만원)
  limit_facility INTEGER,               -- 시설자금 한도 (만원)
  cap_group TEXT,                       -- 총한도 그룹 (같은 그룹 잔액 합산: 소진공_기본_1억 등)
  rate_note TEXT,                       -- 금리 설명
  period_note TEXT,                     -- 상환기간 설명
  eligibility_summary TEXT,             -- 자격 한 줄 요약
  conditions JSONB DEFAULT '[]'::jsonb, -- [{kind:'required'|'any', text}]
  smart_devices JSONB DEFAULT '[]'::jsonb, -- 혁신성장촉진자금용 스마트기기 목록
  criteria JSONB DEFAULT '{}'::jsonb,   -- 자격 자동판정 엔진용 수치/플래그
  reapply_rule JSONB DEFAULT '{}'::jsonb, -- {type:'none'|'months'|'announcement', months, months_by_region:{수도권,지방}, note}
  required_docs JSONB DEFAULT '[]'::jsonb, -- 필요서류 목록
  exclusive_group TEXT,                 -- 같은 그룹끼리 동시 진행 불가 (예: 보증기관)
  notes TEXT,                           -- 실무 메모
  active BOOLEAN DEFAULT TRUE,          -- FALSE면 판정·매칭에서 제외
  sort_order INTEGER DEFAULT 0,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS policy_fund_common_rules (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,                  -- 예: 소상공인 기준 (직원 수)
  content TEXT,                         -- 규칙 본문
  params JSONB DEFAULT '{}'::jsonb,     -- 엔진용 수치
  sort_order INTEGER DEFAULT 0,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
