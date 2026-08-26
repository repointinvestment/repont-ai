-- db/schema_sojinkong_and_secondary.sql
-- 1) 소진공 가점 판단용 필드 추가 (여성기업확인서, 직접대출 성실상환)
-- 2) 계정 정보에 2차 비밀번호(예: 아이핀) 저장용 컬럼 추가
-- Neon SQL Editor에서 한 번 실행하세요. 이미 실행했다면 다시 실행해도 안전합니다.

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS has_woman_biz_cert BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_sojinkong_good_repayment BOOLEAN DEFAULT FALSE;

ALTER TABLE customer_credentials
  ADD COLUMN IF NOT EXISTS secondary_password_encrypted TEXT;
