'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/session'
import AppHeader from '../components/AppHeader'

const ROLE_LABEL = { admin: '관리자', consultant: '컨설턴트', student: '수강생' }

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [accounts, setAccounts] = useState([])

  useEffect(() => {
    const session = getSession()
    if (!session) { router.push('/'); return }
    if (session.role !== 'admin') { router.push('/menu'); return }
    setUser(session)
    fetch('/api/users').then(r => r.json()).then(data => setAccounts(data.users))
  }, [])

  if (!user) return null

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <AppHeader user={user} />

      <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 24px' }}>
        <h2 style={{ color: '#1a1a2e', marginBottom: 8 }}>계정 관리 (컨설턴트 · 수강생)</h2>
        <p style={{ color: '#888', fontSize: 14, marginBottom: 24 }}>
          계정 추가/삭제는 Neon DB의 <strong>accounts</strong> 테이블에서 관리합니다. (db/schema_accounts.sql 참고)
        </p>

        <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8f9fa' }}>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: 13, color: '#555', fontWeight: 600 }}>이름</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: 13, color: '#555', fontWeight: 600 }}>아이디</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: 13, color: '#555', fontWeight: 600 }}>역할</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((acc, i) => (
                <tr key={i} style={{ borderTop: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '14px 20px', fontSize: 14 }}>{acc.name}</td>
                  <td style={{ padding: '14px 20px', fontSize: 14, color: '#666' }}>{acc.username}</td>
                  <td style={{ padding: '14px 20px', fontSize: 14 }}>
                    <span style={{ background: acc.role === 'admin' ? '#e8f0fe' : '#f0f4ff', color: acc.role === 'admin' ? '#1a73e8' : '#555', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{ROLE_LABEL[acc.role] || acc.role}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 24, background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 10, padding: '16px 20px' }}>
          <p style={{ margin: 0, fontSize: 14, color: '#795548', fontWeight: 600 }}>📌 계정 추가 방법</p>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: '#795548', lineHeight: 1.7 }}>
            1. 비밀번호 해시 생성: <code>node -e "console.log(require('bcryptjs').hashSync('비밀번호', 10))"</code><br/>
            2. Neon SQL 콘솔에서 accounts 테이블에 INSERT (db/schema_accounts.sql 하단 예시 참고)<br/>
            3. role은 'admin' · 'consultant' · 'student' 중 하나
          </p>
        </div>
      </div>
    </div>
  )
}
