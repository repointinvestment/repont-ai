// lib/session.js
// 로그인 세션을 localStorage에 저장/조회/삭제하는 공통 헬퍼.
// 새로고침해도 로그인이 풀리지 않도록 이 함수들을 화면마다 재사용합니다.

const SESSION_KEY = 'repoint_user'

// 로그인 성공 시 호출: 세션 저장 (기존 CRM 화면이 참조하는 consultantId/consultantRole도 함께 맞춰줌)
export function setSession(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user))
  localStorage.setItem('consultantId', user.username)
  localStorage.setItem('consultantRole', user.role)
}

// 저장된 세션 조회. 없으면 null.
export function getSession() {
  if (typeof window === 'undefined') return null
  const stored = localStorage.getItem(SESSION_KEY)
  if (!stored) return null
  try {
    return JSON.parse(stored)
  } catch {
    return null
  }
}

// 로그아웃
export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem('consultantId')
  localStorage.removeItem('consultantRole')
}
