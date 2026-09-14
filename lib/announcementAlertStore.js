// lib/announcementAlertStore.js
// 공고 자동 알림 — 기업마당(bizinfo.go.kr) 새 공고를 고객의 사업장 소재지·업종과 대충 매칭해서,
// 수신동의한 고객한테 "OO 지자체에서 [공고명] 공고가 떴습니다" 식으로 자동 발송.
// 내용이 개인화된 자격 판단이 아니라 "공개된 공고가 떴다"는 사실 안내라 사람이 매번 확인할 필요 없이
// 완전자동으로 나감(구DB 재검토=customerRecheckStore.js와 달리 이건 사람 확인 없이 감).
// 같은 공고로 중복 발송되지 않게 seen_announcements에 처리한 공고 ID를 기록.

import { sql } from '@/lib/db'

let schemaReady = false

export async function ensureSchema() {
  if (schemaReady) return
  await sql`
    CREATE TABLE IF NOT EXISTS seen_announcements (
      id SERIAL PRIMARY KEY,
      source TEXT NOT NULL DEFAULT 'bizinfo',
      external_id TEXT NOT NULL,
      title TEXT,
      matched_count INTEGER DEFAULT 0,
      sent_count INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (source, external_id)
    )
  `
  schemaReady = true
}

export async function filterUnseen(source, items, idField) {
  await ensureSchema()
  if (items.length === 0) return []
  const ids = items.map((it) => String(it[idField] ?? it.pblancId ?? it.pblancNm))
  const seen = await sql`SELECT external_id FROM seen_announcements WHERE source = ${source} AND external_id = ANY(${ids})`
  const seenSet = new Set(seen.map((r) => r.external_id))
  return items.filter((it) => !seenSet.has(String(it[idField] ?? it.pblancId ?? it.pblancNm)))
}

export async function markSeen(source, externalId, title, matchedCount, sentCount) {
  await ensureSchema()
  await sql`
    INSERT INTO seen_announcements (source, external_id, title, matched_count, sent_count)
    VALUES (${source}, ${externalId}, ${title || null}, ${matchedCount || 0}, ${sentCount || 0})
    ON CONFLICT (source, external_id) DO NOTHING
  `
}
