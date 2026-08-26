-- db/schema_career_field.sql
-- 대표자 경력(년) 필드 추가 — 기보(기술보증기금) 자격 판단에 사용.
-- Neon SQL Editor에서 한 번 실행하세요. 이미 실행했다면 다시 실행해도 안전합니다.

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS owner_career_years INTEGER;
