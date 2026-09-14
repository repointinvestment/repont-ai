// lib/authz.js
// 고객 ID가 붙은 API 엔드포인트 전반에서 재사용하는 소유권 검증 — 그 고객 담당 컨설턴트
// (consultant_id 일치) 또는 admin만 접근 가능. 검증 안 하면 고객 ID만 알아도 다른 컨설턴트가
// 남의 고객 데이터에 접근할 수 있는 구멍이 생김(실제로 여러 라우트에서 발견되어 일괄 수정함).

import { sql } from '@/lib/db'

export async function requireCustomerOwnership(customerId, request) {
  const [customer] = await sql`SELECT consultant_id FROM customers WHERE id = ${customerId}`
  if (!customer) return { ok: false, status: 404, error: '고객을 찾을 수 없습니다.' }
  const username = request.headers.get('x-consultant-id')
  const role = request.headers.get('x-consultant-role')
  if (role !== 'admin' && String(customer.consultant_id) !== String(username)) {
    return { ok: false, status: 403, error: '본인이 담당하는 고객만 접근할 수 있습니다.' }
  }
  return { ok: true, customer }
}
