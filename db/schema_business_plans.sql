-- db/schema_business_plans.sql
-- 생성된 사업계획서 초안을 저장하는 테이블. 현재는 생성 즉시 화면에서만 보이고 사라졌는데,
-- 앞으로는 전체 고객의 초안을 한곳에서 모아볼 수 있게 저장합니다.
-- Neon SQL Editor에서 한 번 실행하세요. 이미 실행했다면 다시 실행해도 안전합니다.

CREATE TABLE IF NOT EXISTS business_plans (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  fund_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_plans_customer_id ON business_plans(customer_id);
