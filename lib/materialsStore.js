// lib/materialsStore.js
// 안내자료 — 컨설턴트가 이미지·텍스트 블록으로 만드는 고객용 안내 페이지(절세·상속·법인전환 등
// 직접 작성하는 자료). 노션 대신 자금비서 안에서 만들고, 카카오 알림의 #{자료확인하기} 링크가
// 이 페이지로 연결됨. 페이지 안에 "문의하기" 버튼이 있어서 누르면 CRM에 자동 기록됨.

import { sql } from '@/lib/db'

let schemaReady = false

export async function ensureSchema() {
  if (schemaReady) return
  await sql`
    CREATE TABLE IF NOT EXISTS materials (
      id SERIAL PRIMARY KEY,
      consultant_username TEXT NOT NULL,
      title TEXT NOT NULL,
      blocks JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{type:'text', content} | {type:'image', url}]
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS material_inquiries (
      id SERIAL PRIMARY KEY,
      material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL, -- 토큰으로 알아본 기존 고객이면 채워짐
      name TEXT, -- 모르는 사람이 문의한 경우(토큰 없음) 직접 남긴 이름
      phone TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  schemaReady = true
}

export async function listMaterials(consultantUsername) {
  await ensureSchema()
  return sql`SELECT * FROM materials WHERE consultant_username = ${consultantUsername} ORDER BY updated_at DESC`
}

export async function getMaterial(id) {
  await ensureSchema()
  const [row] = await sql`SELECT * FROM materials WHERE id = ${id}`
  return row || null
}

export async function createMaterial(consultantUsername, { title, blocks }) {
  await ensureSchema()
  const [row] = await sql`
    INSERT INTO materials (consultant_username, title, blocks)
    VALUES (${consultantUsername}, ${title}, ${JSON.stringify(blocks || [])})
    RETURNING *
  `
  return row
}

export async function updateMaterial(id, { title, blocks }) {
  await ensureSchema()
  const [row] = await sql`
    UPDATE materials SET title = ${title}, blocks = ${JSON.stringify(blocks || [])}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `
  return row || null
}

export async function deleteMaterial(id) {
  await ensureSchema()
  await sql`DELETE FROM materials WHERE id = ${id}`
}

export async function logInquiry(materialId, { customerId, name, phone }) {
  await ensureSchema()
  const [row] = await sql`
    INSERT INTO material_inquiries (material_id, customer_id, name, phone)
    VALUES (${materialId}, ${customerId || null}, ${name || null}, ${phone || null})
    RETURNING *
  `
  return row
}

export async function listInquiries(materialId) {
  await ensureSchema()
  return sql`
    SELECT mi.*, c.owner_name AS customer_owner_name, c.business_name AS customer_business_name
    FROM material_inquiries mi LEFT JOIN customers c ON c.id = mi.customer_id
    WHERE mi.material_id = ${materialId} ORDER BY mi.created_at DESC
  `
}
