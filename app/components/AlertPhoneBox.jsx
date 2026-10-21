'use client'
import { useState, useEffect } from 'react'

// 정부지원사업 매칭 알림을 받을 내 휴대폰번호 등록
export default function AlertPhoneBox({ user }) {
  const headers = { 'x-consultant-id': user.username, 'x-consultant-role': user.role, 'Content-Type': 'application/json' }
  const [phone, setPhone] = useState('')
  const [msg, setMsg] = useState('')
  useEffect(() => {
    fetch('/api/account/alert-phone', { headers }).then((r) => r.json()).then((d) => setPhone(d.phone || '')).catch(() => {})
  }, [])
  const save = async () => {
    const res = await fetch('/api/account/alert-phone', { method: 'POST', headers, body: JSON.stringify({ phone }) })
    const d = await res.json()
    setMsg(res.ok ? '저장했어요.' : d.error || '저장 실패')
  }
  return (
    <div style={{ maxWidth: 880, margin: '14px auto 0', padding: '12px 16px', background: '#fff', borderRadius: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.05)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}>
      <strong>📲 내 알림 번호</strong>
      <span style={{ color: '#8A8A85', fontSize: 12 }}>내 고객 중 새 정부지원사업 대상이 생기면 이 번호로 문자가 와요</span>
      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" style={{ padding: '6px 10px', border: '1px solid #D3D1C7', borderRadius: 7, width: 150 }} />
      <button onClick={save} style={{ padding: '6px 12px', border: 'none', borderRadius: 7, background: '#0B2440', color: '#fff', cursor: 'pointer' }}>저장</button>
      {msg && <span style={{ color: '#5F5E5A', fontSize: 12 }}>{msg}</span>}
    </div>
  )
}
