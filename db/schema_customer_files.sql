-- db/schema_customer_files.sql
-- 고객별 파일 보관함용 테이블. 실제 파일은 Vercel Blob에 저장되고, 여기엔 메타데이터만 저장합니다.
-- Neon SQL Editor에서 한 번 실행하세요. 이미 실행했다면 다시 실행해도 안전합니다.

CREATE TABLE IF NOT EXISTS customer_files (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  blob_url TEXT NOT NULL,
  size_bytes BIGINT,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_files_customer_id ON customer_files(customer_id);
