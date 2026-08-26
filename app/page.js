'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { setSession, getSession } from '@/lib/session'

export default function LoginPage() {
  const router = useRouter()
  const [id, setId] = useState('')
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // 이미 로그인되어 있으면 로그인 화면을 건너뛰고 바로 메뉴로 (세션 유지)
  useEffect(() => {
    const existing = getSession()
    if (existing) router.push('/menu')
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, pw })
    })
    const data = await res.json()
    setLoading(false)
    if (data.ok) {
      setSession(data.user)
      router.push('/menu')
    } else {
      setError('아이디 또는 비밀번호가 올바르지 않습니다.')
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
      <div style={{ background: 'white', borderRadius: 16, padding: '48px 40px', width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>💼</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1a1a2e' }}>자금비서</h1>
          <p style={{ margin: '8px 0 0', color: '#888', fontSize: 14 }}>정책자금 AI 컨설턴트</p>
        </div>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 6 }}>아이디</label>
            <input
              value={id}
              onChange={e => setId(e.target.value)}
              placeholder="아이디 입력"
              style={{ width: '100%', padding: '12px 14px', border: '1.5px solid #e0e0e0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
              required
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 6 }}>비밀번호</label>
            <input
              type="password"
              value={pw}
              onChange={e => setPw(e.target.value)}
              placeholder="비밀번호 입력"
              style={{ width: '100%', padding: '12px 14px', border: '1.5px solid #e0e0e0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
              required
            />
          </div>
          {error && <p style={{ color: '#e74c3c', fontSize: 13, margin: '0 0 16px', textAlign: 'center' }}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: '13px', background: loading ? '#aaa' : '#0f3460', color: 'white', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  )
}
