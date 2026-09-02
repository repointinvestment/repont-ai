'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/session'
import AppHeader from '../components/AppHeader'

const ROLE_LABEL = { admin: '관리자', consultant: '컨설턴트', student: '컨설턴트' } // student는 과거 계정 호환용 라벨일 뿐 — 이제 신규 생성 옵션에는 없음

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [form, setForm] = useState({ username: '', password: '', name: '', role: 'consultant' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    const session = getSession()
    if (!session) { router.push('/'); return }
    if (session.role !== 'admin') { router.push('/menu'); return }
    setUser(session)
    loadAccounts()
  }, [])

  function loadAccounts() {
    fetch('/api/users').then(r => r.json()).then(data => setAccounts(data.users))
  }

  async function handleCreate(e) {
    e.preventDefault()
    setError(null)
    if (!form.username || !form.password || !form.name) {
      setError('아이디, 비밀번호, 이름을 모두 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '계정 생성 실패')
      setForm({ username: '', password: '', name: '', role: 'student' })
      setShowForm(false)
      loadAccounts()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null

  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D3D1C7', fontSize: 14, boxSizing: 'border-box' }
  const labelStyle = { fontSize: 13, color: '#5F5E5A', display: 'block', marginBottom: 6 }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <AppHeader user={user} />

      <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h2 style={{ color: '#1a1a2e', margin: 0 }}>계정 관리 (컨설턴트)</h2>
          <button
            onClick={() => router.push('/admin/policy-funds')}
            style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid #2A2925', background: '#fff', color: '#2A2925', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', marginLeft: 12 }}
          >
            정책자금 마스터 DB 관리 →
          </button>
          <button
            onClick={() => setShowForm((s) => !s)}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#D85A30', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            {showForm ? '닫기' : '+ 계정 추가'}
          </button>
        </div>
        <p style={{ color: '#888', fontSize: 14, marginBottom: 24 }}>
          새로 만든 계정의 이름은 로그인 후 화면 곳곳(고객명단, 메뉴 등)에 자동으로 반영됩니다.
        </p>

        {showForm && (
          <form onSubmit={handleCreate} style={{ background: 'white', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', padding: 24, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <label>
                <span style={labelStyle}>이름</span>
                <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="예: 문수환" />
              </label>
              <label>
                <span style={labelStyle}>역할</span>
                <select style={inputStyle} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="consultant">컨설턴트</option>
                  <option value="admin">관리자</option>
                </select>
              </label>
              <label>
                <span style={labelStyle}>아이디</span>
                <input style={inputStyle} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="로그인용 아이디" />
              </label>
              <label>
                <span style={labelStyle}>비밀번호</span>
                <input type="text" style={inputStyle} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="초기 비밀번호" />
              </label>
            </div>
            {error && <p style={{ fontSize: 13, color: '#c0392b', margin: 0 }}>{error}</p>}
            <button
              type="submit"
              disabled={saving}
              style={{ alignSelf: 'flex-start', padding: '10px 20px', borderRadius: 8, border: 'none', background: saving ? '#ccc' : '#1a1a2e', color: '#fff', fontSize: 14, fontWeight: 600, cursor: saving ? 'default' : 'pointer' }}
            >
              {saving ? '생성 중...' : '계정 생성'}
            </button>
          </form>
        )}

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
      </div>
    </div>
  )
}
