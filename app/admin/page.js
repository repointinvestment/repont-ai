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
  const [customers, setCustomers] = useState([])
  const [form, setForm] = useState({ username: '', password: '', name: '', role: 'consultant' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [resettingPw, setResettingPw] = useState(null) // 비밀번호 재설정 중인 계정
  const [newPw, setNewPw] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState(null)
  const [pwDone, setPwDone] = useState(null) // 완료 후 잠깐 보여줄 계정 아이디

  useEffect(() => {
    const session = getSession()
    if (!session) { router.push('/'); return }
    if (session.role !== 'admin') { router.push('/menu'); return }
    setUser(session)
    loadAccounts()
    // 가벼운 활동 현황용 — 이미 있는 고객 목록 API를 그대로 재사용(추가 API 없음), 컨설턴트별로 묶어서 개수·최근활동만 계산
    fetch('/api/customers', { headers: { 'x-consultant-id': session.username, 'x-consultant-role': session.role } })
      .then((r) => r.json()).then((d) => setCustomers(d.customers || []))
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

  function openResetPw(acc) {
    setResettingPw(acc)
    setNewPw('')
    setPwError(null)
  }

  async function submitResetPw() {
    if (!newPw || newPw.length < 4) { setPwError('비밀번호는 4자 이상이어야 합니다.'); return }
    setPwSaving(true); setPwError(null)
    try {
      const res = await fetch(`/api/users/${resettingPw.username}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-consultant-id': user.username, 'x-consultant-role': user.role },
        body: JSON.stringify({ password: newPw }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '변경 실패')
      setPwDone(resettingPw.username)
      setResettingPw(null)
      setTimeout(() => setPwDone(null), 4000)
    } catch (err) {
      setPwError(err.message)
    } finally {
      setPwSaving(false)
    }
  }

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
            onClick={() => router.push('/admin/contracts')}
            style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid #2A2925', background: '#fff', color: '#2A2925', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', marginLeft: 8 }}
          >
            전체 계약 현황 →
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
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: 13, color: '#555', fontWeight: 600 }}>담당 고객</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: 13, color: '#555', fontWeight: 600 }}>최근 활동</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: 13, color: '#555', fontWeight: 600 }}></th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((acc, i) => {
                const own = customers.filter((c) => String(c.consultant_id) === String(acc.username))
                const lastActive = own.reduce((max, c) => (c.updated_at > max ? c.updated_at : max), '')
                const daysAgo = lastActive ? Math.floor((Date.now() - new Date(lastActive)) / 86400000) : null
                return (
                  <tr key={i} style={{ borderTop: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '14px 20px', fontSize: 14 }}>{acc.name}</td>
                    <td style={{ padding: '14px 20px', fontSize: 14, color: '#666' }}>{acc.username}</td>
                    <td style={{ padding: '14px 20px', fontSize: 14 }}>
                      <span style={{ background: acc.role === 'admin' ? '#e8f0fe' : '#f0f4ff', color: acc.role === 'admin' ? '#1a73e8' : '#555', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{ROLE_LABEL[acc.role] || acc.role}</span>
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: 14 }}>
                      {acc.role === 'admin' ? '—' : (
                        own.length > 0
                          ? <button onClick={() => router.push(`/customers?consultant=${acc.username}`)} style={{ background: 'none', border: 'none', color: '#D85A30', fontSize: 14, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>{own.length}명 보기</button>
                          : <span style={{ color: '#B0AEA5' }}>0명</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: 13, color: daysAgo != null && daysAgo >= 7 ? '#B24A2B' : '#666' }}>
                      {acc.role === 'admin' ? '—' : daysAgo == null ? '활동 없음' : daysAgo === 0 ? '오늘' : `${daysAgo}일 전`}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <button onClick={() => openResetPw(acc)} style={{ padding: '6px 11px', borderRadius: 7, border: '1px solid #D3D1C7', background: '#fff', color: '#5F5E5A', fontSize: 12, cursor: 'pointer' }}>비밀번호 변경</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {pwDone && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#1a1a2e', color: '#fff', padding: '12px 18px', borderRadius: 10, fontSize: 13, boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
          ✓ {pwDone} 계정 비밀번호를 변경했습니다.
        </div>
      )}

      {resettingPw && (
        <div onClick={() => setResettingPw(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 22, width: 340 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#2A2925', margin: '0 0 4px' }}>비밀번호 변경</p>
            <p style={{ fontSize: 12.5, color: '#8A8A85', margin: '0 0 16px' }}>{resettingPw.name} ({resettingPw.username}) 계정의 새 비밀번호를 입력하세요. 기존 비밀번호는 확인할 수 없어 새로 덮어씁니다.</p>
            <input
              type="text"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="새 비밀번호"
              autoFocus
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D3D1C7', fontSize: 14, boxSizing: 'border-box', marginBottom: 12 }}
            />
            {pwError && <p style={{ color: '#C0392B', fontSize: 12.5, margin: '0 0 10px' }}>{pwError}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setResettingPw(null)} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid #2A2925', background: '#fff', color: '#2A2925', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>취소</button>
              <button onClick={submitResetPw} disabled={pwSaving} style={{ padding: '9px 14px', borderRadius: 8, border: 'none', background: '#1a1a2e', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {pwSaving ? '변경 중...' : '변경'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
