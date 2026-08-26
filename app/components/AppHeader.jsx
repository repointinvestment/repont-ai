'use client'
import { useRouter } from 'next/navigation'
import { clearSession } from '@/lib/session'

// 로그인 이후 화면들(메뉴, CRM, AI 상담, 관리자)에서 공통으로 쓰는 상단 헤더.
export default function AppHeader({ user }) {
  const router = useRouter()

  const handleLogout = () => {
    clearSession()
    router.push('/')
  }

  if (!user) return null

  return (
    <div style={{
      background: '#0f3460',
      color: 'white',
      padding: '14px 24px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }} onClick={() => router.push('/menu')}>
        <span style={{ fontWeight: 700, fontSize: 16 }}>💼 자금비서</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 13, opacity: 0.85 }}>{user.name}님</span>
        {user.role === 'admin' && (
          <button
            onClick={() => router.push('/admin')}
            style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}
          >
            관리자
          </button>
        )}
        <button
          onClick={handleLogout}
          style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}
        >
          로그아웃
        </button>
      </div>
    </div>
  )
}
