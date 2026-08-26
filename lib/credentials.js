// lib/credentials.js
import { sql } from '@/lib/db'
import { encrypt } from '@/lib/crypto'

// 소진공, 홈택스 등 서비스명을 자유롭게 지정하는 계정 정보. 아이디는 평문, 비밀번호(들)만 암호화.
// 비밀번호를 비워두고 저장하면 기존 비밀번호는 유지하고 아이디만 갱신. 저장된 row를 반환.
export async function upsertNamedCredential(customerId, serviceName, username, plainPassword, plainSecondaryPassword) {
  if (!serviceName) return null
  const existing = await sql`
    SELECT id, password_encrypted, secondary_password_encrypted FROM customer_credentials
    WHERE customer_id = ${customerId} AND service_name = ${serviceName}
  `
  const encrypted = plainPassword ? encrypt(plainPassword) : (existing[0]?.password_encrypted || '')
  const secondaryEncrypted = plainSecondaryPassword
    ? encrypt(plainSecondaryPassword)
    : (existing[0]?.secondary_password_encrypted || null)

  if (existing.length > 0) {
    const [row] = await sql`
      UPDATE customer_credentials SET username = ${username || ''}, password_encrypted = ${encrypted}, secondary_password_encrypted = ${secondaryEncrypted}
      WHERE id = ${existing[0].id}
      RETURNING id, service_name, username
    `
    return row
  }
  const [row] = await sql`
    INSERT INTO customer_credentials (customer_id, service_name, username, password_encrypted, secondary_password_encrypted)
    VALUES (${customerId}, ${serviceName}, ${username || ''}, ${encrypted}, ${secondaryEncrypted})
    RETURNING id, service_name, username
  `
  return row
}
