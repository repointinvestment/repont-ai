'use client'
import { useEffect } from 'react'

// 서버가 세션 쿠키를 검증하게 된 뒤, 예전 방식(localStorage만)으로 로그인돼 있던 화면이나
// 만료된 세션이 API에서 401을 받으면 로그인 화면으로 보내줍니다.
export default function AuthFetchGuard() {
  useEffect(() => {
    if (window.__authGuardInstalled) return
    window.__authGuardInstalled = true
    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      const res = await originalFetch(...args)
      try {
        const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || ''
        if (res.status === 401 && url.startsWith('/api/') && !url.startsWith('/api/auth')) {
          if (localStorage.getItem('repoint_user')) {
            localStorage.removeItem('repoint_user')
            localStorage.removeItem('consultantId')
            localStorage.removeItem('consultantRole')
            if (window.location.pathname !== '/') window.location.href = '/'
          }
        }
      } catch {}
      return res
    }
  }, [])
  return null
}
