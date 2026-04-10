'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// 계정 목록 (auth/route.js와 동일하게 유지)
const ACCOUNTS = [
  { id: 'admin', name: '관리자', role: 'admin', status: '활성' },
  { id: 'staff01', name: '직원1', role: '직원', status: '활성' },
  { id: 'staff02', name: '직원2', role: '직원', status: '활성' },
]

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)

  useEffect(() => {
    const stored = localStorage.getItem('repoint_user')
    if (!stored) { router.push('/'); return }
    const u = JSON.parse(stored)
    if (u.role !== 'admin') { router.push('/chat'); return }
    setUser(u)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('repoint_user')
    router.push('/')
  }

  if (!user) return null

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      {/* Header */}
      <div style={{ background: '#0f3460', color: 'white', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, fontSize: 16 }}>💼 리포인트파트너스 — 관리자</span>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => router.push('/chat')} style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 13, cursor: 'pointer' }}>AI 채팅</button>
          <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 13, cursor: 'pointer' }}>로그아웃</button>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 24px' }}>
        <h2 style={{ color: '#1a1a2e', marginBottom: 8 }}>직원 계정 관리</h2>
        <p style={{ color: '#888', fontSize: 14, marginBottom: 24 }}>
          직원 추가/삭제는 <strong>app/api/auth/route.js</strong> 파일의 USERS 목록을 수정하세요.
        </p>

        <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8f9fa' }}>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: 13, color: '#555', fontWeight: 600 }}>이름</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: 13, color: '#555', fontWeight: 600 }}>아이디</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: 13, color: '#555', fontWeight: 600 }}>역할</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: 13, color: '#555', fontWeight: 600 }}>상태</th>
              </tr>
            </thead>
            <tbody>
              {ACCOUNTS.map((acc, i) => (
                <tr key={i} style={{ borderTop: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '14px 20px', fontSize: 14 }}>{acc.name}</td>
                  <td style={{ padding: '14px 20px', fontSize: 14, color: '#666' }}>{acc.id}</td>
                  <td style={{ padding: '14px 20px', fontSize: 14 }}>
                    <span style={{ background: acc.role === 'admin' ? '#e8f0fe' : '#f0f4ff', color: acc.role === 'admin' ? '#1a73e8' : '#555', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{acc.role}</span>
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: 14 }}>
                    <span style={{ background: '#e6f9f0', color: '#1a8a4a', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{acc.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 24, background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 10, padding: '16px 20px' }}>
          <p style={{ margin: 0, fontSize: 14, color: '#795548', fontWeight: 600 }}>📌 직원 추가/삭제 방법</p>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: '#795548', lineHeight: 1.7 }}>
            1. GitHub에서 <strong>app/api/auth/route.js</strong> 파일 열기<br/>
            2. USERS 배열에서 직원 추가 또는 삭제<br/>
            3. 저장하면 자동으로 반영됨 (퇴사자는 해당 줄 삭제)
          </p>
        </div>
      </div>
    </div>
  )
}
