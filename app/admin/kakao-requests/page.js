'use client'

// app/admin/kakao-requests/page.js
// 컨설턴트들이 "간편 신청"으로 낸 카카오 알림 연동 요청 큐. 대표가 여기서 신청 정보를 보고
// 실제 솔라피/카카오 설정 작업을 진행한 뒤, 완료되면 키 값을 대신 입력해서 연동을 켜줌.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/session'
import AppHeader from '../../components/AppHeader'

const STATUS_STYLE = {
  requested: { text: '신청됨', bg: '#FAEEDA', fg: '#633806' },
  in_progress: { text: '처리 중', bg: '#E6F1FB', fg: '#0C447C' },
  active: { text: '연동 완료', bg: '#E1F5EE', fg: '#085041' },
}

const input = { width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid #D3D1C7', fontSize: 13.5, boxSizing: 'border-box' }
const label = { fontSize: 12, color: '#5F5E5A', display: 'block', marginBottom: 5, fontWeight: 600 }
const btn = { padding: '9px 14px', borderRadius: 8, border: 'none', background: '#2A2925', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const btnGhost = { ...btn, background: '#fff', color: '#2A2925', border: '1px solid #2A2925' }

export default function KakaoRequestsAdminPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [requests, setRequests] = useState([])
  const [editing, setEditing] = useState(null) // consultant_username being processed
  const [keyForm, setKeyForm] = useState({ apiKey: '', apiSecret: '', senderKey: '', senderPhone: '', templateId: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const s = getSession()
    if (!s) { router.push('/'); return }
    if (s.role !== 'admin') { router.push('/menu'); return }
    setUser(s)
    load(s)
  }, [])

  async function load(s = user) {
    const d = await fetch('/api/admin/messaging-requests', { headers: { 'x-consultant-id': s.username, 'x-consultant-role': s.role } }).then((r) => r.json())
    setRequests(d.requests || [])
  }

  async function markInProgress(r) {
    await fetch('/api/admin/messaging-requests', {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-consultant-id': user.username, 'x-consultant-role': user.role },
      body: JSON.stringify({ consultantUsername: r.consultant_username, status: 'in_progress' }),
    })
    load()
  }

  function openKeyEntry(r) {
    setEditing(r.consultant_username)
    setKeyForm({ apiKey: r.api_key || '', apiSecret: '', senderKey: r.sender_key || '', senderPhone: r.sender_phone || '', templateId: r.template_id || '' })
  }

  async function saveKeys() {
    setSaving(true)
    try {
      await fetch('/api/admin/messaging-requests', {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-consultant-id': user.username, 'x-consultant-role': user.role },
        body: JSON.stringify({ consultantUsername: editing, ...keyForm }),
      })
      setEditing(null)
      load()
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null

  return (
    <div style={{ minHeight: '100vh', background: '#F7F6F2' }}>
      <AppHeader user={user} />
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '28px 20px 60px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ color: '#1a1a2e', margin: 0 }}>카카오 알림 연동 신청함</h2>
            <p style={{ fontSize: 13, color: '#8A8A85', margin: '6px 0 0' }}>컨설턴트가 낸 연동 신청입니다. 솔라피·카카오 채널 설정을 대신 진행한 뒤 키를 입력해 연동을 켜주세요.</p>
          </div>
          <button style={btnGhost} onClick={() => router.push('/menu')}>메뉴로</button>
        </div>

        {requests.length === 0 && <p style={{ fontSize: 13, color: '#B0AEA5' }}>신청 건이 없습니다.</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {requests.map((r) => {
            const st = STATUS_STYLE[r.request_status] || STATUS_STYLE.requested
            return (
              <div key={r.consultant_username} style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 14, color: '#2A2925' }}>{r.consultant_name || r.consultant_username}</strong>
                      <span style={{ fontSize: 11, color: '#8A8A85' }}>@{r.consultant_username}</span>
                      <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 999, background: st.bg, color: st.fg, fontWeight: 700 }}>{st.text}</span>
                    </div>
                    <p style={{ fontSize: 12.5, color: '#5F5E5A', margin: '6px 0 0' }}>
                      상호명: {r.request_business_name || '-'} · 사업자번호: {r.request_biz_reg_number || '-'} · 연락처: {r.request_phone || '-'} · 이메일: {r.request_email || '-'}
                    </p>
                    {r.request_note && <p style={{ fontSize: 12, color: '#8A8A85', margin: '4px 0 0' }}>메모: {r.request_note}</p>}
                    {r.requested_at && <p style={{ fontSize: 11, color: '#B0AEA5', margin: '4px 0 0' }}>신청일: {new Date(r.requested_at).toLocaleString('ko-KR')}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {r.request_status === 'requested' && <button style={btnGhost} onClick={() => markInProgress(r)}>처리중으로</button>}
                    <button style={btn} onClick={() => openKeyEntry(r)}>키 입력</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {editing && (
        <div onClick={() => setEditing(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 22, width: 380 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#2A2925', margin: '0 0 14px' }}>{editing} 연동 키 입력</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div><span style={label}>API Key</span><input style={input} value={keyForm.apiKey} onChange={(e) => setKeyForm({ ...keyForm, apiKey: e.target.value })} /></div>
              <div><span style={label}>API Secret</span><input style={input} type="password" value={keyForm.apiSecret} onChange={(e) => setKeyForm({ ...keyForm, apiSecret: e.target.value })} placeholder="비워두면 기존 값 유지" /></div>
              <div><span style={label}>카카오 채널 프로필키 (pfId)</span><input style={input} value={keyForm.senderKey} onChange={(e) => setKeyForm({ ...keyForm, senderKey: e.target.value })} /></div>
              <div><span style={label}>발신번호</span><input style={input} value={keyForm.senderPhone} onChange={(e) => setKeyForm({ ...keyForm, senderPhone: e.target.value })} /></div>
              <div><span style={label}>템플릿 ID</span><input style={input} value={keyForm.templateId} onChange={(e) => setKeyForm({ ...keyForm, templateId: e.target.value })} /></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button style={btnGhost} onClick={() => setEditing(null)}>취소</button>
              <button style={btn} disabled={saving} onClick={saveKeys}>{saving ? '저장 중…' : '저장하고 연동 켜기'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
