-- db/schema_status_history.sql
-- 고객 진행 단계(상담중/서류준비/심사중/완료)가 바뀔 때마다 기록을 남기는 테이블.
-- Neon SQL Editor에서 한 번 실행하세요. 이미 실행했다면 다시 실행해도 안전합니다.

CREATE TABLE IF NOT EXISTS customer_status_history (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_status_history_customer_id ON customer_status_history(customer_id);

-- 기존에 등록된 고객들 중 이력이 없는 고객은, 현재 상태를 기준으로 1건씩 기록해서
-- 이후부터는 단계 변경 이력이 쌓이도록 채워둡니다. (등록 당시 날짜까지는 소급하지 않습니다)
INSERT INTO customer_status_history (customer_id, status, changed_at)
SELECT c.id, COALESCE(c.status, '상담중'), NOW()
FROM customers c
WHERE NOT EXISTS (
  SELECT 1 FROM customer_status_history h WHERE h.customer_id = c.id
);
