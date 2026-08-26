// lib/db.js
// Neon 서버리스 드라이버 연결 헬퍼.
// DATABASE_URL은 Vercel이 Neon 연결 시 자동으로 넣어준 환경변수라 따로 설정할 필요 없음.

import { neon } from '@neondatabase/serverless'

export const sql = neon(process.env.DATABASE_URL)

// 사용 예:
//   import { sql } from '@/lib/db'
//   const rows = await sql`SELECT * FROM customers WHERE consultant_id = ${consultantId}`
