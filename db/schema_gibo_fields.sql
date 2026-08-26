-- db/schema_gibo_fields.sql
-- 기보(기술보증기금) 자격 판단용 필드 추가. Neon SQL Editor에서 한 번 실행하세요.
-- 이미 실행했다면 다시 실행해도 안전합니다 (IF NOT EXISTS).

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS has_patent BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_yellow_umbrella BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_rnd_center BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_venture_cert BOOLEAN DEFAULT FALSE;
