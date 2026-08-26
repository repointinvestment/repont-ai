-- db/schema_policy_fund_details.sql
-- 고객별 정책자금 상세 정보(기관별 실제 잔액, 재신청 가능일, 자격조건, 스마트기기 보유현황) 저장용.
-- Neon SQL Editor에서 한 번 실행하세요. 이미 실행했다면 다시 실행해도 안전합니다.

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS business_age_years INTEGER,
  ADD COLUMN IF NOT EXISTS policy_fund_details JSONB DEFAULT '{}'::jsonb;
