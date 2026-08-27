-- db/schema_codef.sql
-- CODEF 간편인증(2-way) 진행 상태를 1차 요청~2차 확인 사이 짧게 보관하는 테이블.
-- 카카오톡 등에서 사용자가 승인하기까지 기다리는 동안만 필요하므로 값이 오래 남아있을 필요는 없음
-- (필요하면 나중에 created_at 기준으로 오래된 pending 행을 주기적으로 정리해도 됨).
-- Neon SQL Editor에서 한 번 실행하세요. 이미 실행했다면 다시 실행해도 안전합니다.

CREATE TABLE IF NOT EXISTS codef_auth_sessions (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  created_by TEXT,
  product TEXT NOT NULL DEFAULT 'corporate-registration', -- 어떤 CODEF 상품 요청인지 구분
  status TEXT NOT NULL DEFAULT 'pending', -- pending | confirmed | failed
  job_index INTEGER,
  thread_index INTEGER,
  jti TEXT,
  two_way_timestamp BIGINT,
  request_payload JSONB NOT NULL, -- 1차 요청 바디(민감정보는 이미 RSA 암호화된 상태) — 2차 요청 시 재사용
  result_payload JSONB, -- 성공/실패 시 CODEF 응답 저장 (디버깅/테스트 확인용)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_codef_auth_sessions_customer_id ON codef_auth_sessions(customer_id);
