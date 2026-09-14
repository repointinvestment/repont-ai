'use client'

// app/admin/kakao-requests/page.js
// 카카오 알림(머니콕) 관리 — (1) 회사 공용 솔라피 계정 설정(1회성) (2) 컨설턴트별 채널 연동 신청 처리.

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

export default function KakaoAdminPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [requests, setRequests] = useState([])
  const [companyConfig, setCompanyConfig] = useState(null)
  const [companyForm, setCompanyForm] = useState({ apiKey: '', apiSecret: '', templateId: '', senderPhone: '' })
  const [companySaving, setCompanySaving] = useState(false)
  const [companySaved, setCompanySaved] = useState(false)
  const [editing, setEditing] = useState(null)
  const [senderKeyInput, setSenderKeyInput] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const s = getSession()
    if (!s) { router.push('/'); return }
    if (s.role !== 'admin') { router.push('/menu'); return }
    setUser(s)
    load(s)
  }, [])

  async function load(s = user) {
    const headers = { 'x-consultant-id': s.username, 'x-consultant-role': s.role }
    const [reqData, cfgData] = await Promise.all([
      fetch('/api/admin/channel-requests', { headers }).then((r) => r.json()),
      fetch('/api/admin/company-messaging-config', { headers }).then((r) => r.json()),
    ])
    setRequests(reqData.requests || [])
    if (cfgData.config) {
      setCompanyConfig(cfgData.config)
      setCompanyForm((f) => ({ ...f, apiKey: cfgData.config.apiKey, templateId: cfgData.config.templateId, senderPhone: cfgData.config.senderPhone }))
    }
  }

  async function saveCompanyConfig() {
    setCompanySaving(true); setCompanySaved(false)
    try {
      await fetch('/api/admin/company-messaging-config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-consultant-id': user.username, 'x-consultant-role': user.role },
        body: JSON.stringify(companyForm),
      })
      setCompanySaved(true)
      setCompanyForm((f) => ({ ...f, apiSecret: '' }))
      load()
    } finally {
      setCompanySaving(false)
    }
  }

  async function markInProgress(r) {
    await fetch('/api/admin/channel-requests', {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-consultant-id': user.username, 'x-consultant-role': user.role },
      body: JSON.stringify({ consultantUsername: r.consultant_username, status: 'in_progress' }),
    })
    load()
  }

  function openKeyEntry(r) {
    setEditing(r.consultant_username)
    setSenderKeyInput(r.sender_key || '')
  }

  async function saveSenderKey() {
    setSaving(true)
    try {
      await fetch('/api/admin/channel-requests', {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-consultant-id': user.username, 'x-consultant-role': user.role },
        body: JSON.stringify({ consultantUsername: editing, senderKey: senderKeyInput }),
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
          <h2 style={{ color: '#1a1a2e', margin: 0 }}>카카오 알림(머니콕) 관리</h2>
          <button style={btnGhost} onClick={() => router.push('/menu')}>메뉴로</button>
        </div>

        {/* 회사 공용 솔라피 계정 */}
        <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.05)', marginBottom: 24 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#2A2925', margin: '0 0 4px' }}>회사 공용 솔라피 계정 (1회 설정)</p>
          <p style={{ fontSize: 12, color: '#8A8A85', margin: '0 0 14px' }}>전체 컨설턴트가 같이 쓰는 API키·템플릿입니다. 한 번만 설정하면 됩니다.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><span style={label}>API Key</span><input style={input} value={companyForm.apiKey} onChange={(e) => setCompanyForm({ ...companyForm, apiKey: e.target.value })} /></div>
            <div>
              <span style={label}>API Secret {companyConfig?.hasApiSecret && <span style={{ color: '#B0AEA5', fontWeight: 400 }}>(연결됨: {companyConfig.apiSecretMasked})</span>}</span>
              <input style={input} type="password" value={companyForm.apiSecret} onChange={(e) => setCompanyForm({ ...companyForm, apiSecret: e.target.value })} placeholder={companyConfig?.hasApiSecret ? '변경하려면 새로 입력' : ''} />
            </div>
            <div><span style={label}>알림톡 템플릿 ID</span><input style={input} value={companyForm.templateId} onChange={(e) => setCompanyForm({ ...companyForm, templateId: e.target.value })} /></div>
            <div><span style={label}>발신번호</span><input style={input} value={companyForm.senderPhone} onChange={(e) => setCompanyForm({ ...companyForm, senderPhone: e.target.value })} /></div>
          </div>
          {companySaved && <p style={{ color: '#085041', fontSize: 12.5, margin: '10px 0 0' }}>✓ 저장했습니다.</p>}
          <button style={{ ...btn, marginTop: 12 }} disabled={companySaving} onClick={saveCompanyConfig}>{companySaving ? '저장 중…' : '저장'}</button>
        </div>

        {/* 컨설턴트별 채널 연동 신청 */}
        <p style={{ fontSize: 14, fontWeight: 700, color: '#2A2925', margin: '0 0 10px' }}>컨설턴트 채널 연동 신청</p>
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
                      상호명: {r.request_business_name || '-'} · 연락처: {r.request_phone || '-'} · 이메일: {r.request_email || '-'}
                    </p>
                    {r.request_note && <p style={{ fontSize: 12, color: '#8A8A85', margin: '4px 0 0' }}>메모: {r.request_note}</p>}
                    {r.sender_key && <p style={{ fontSize: 12, color: '#5F5E5A', margin: '4px 0 0' }}>연동된 채널 pfId: {r.sender_key}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {r.request_status === 'requested' && <button style={btnGhost} onClick={() => markInProgress(r)}>처리중으로</button>}
                    <button style={btn} onClick={() => openKeyEntry(r)}>채널 pfId 입력</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {editing && (
        <div onClick={() => setEditing(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 22, width: 340 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#2A2925', margin: '0 0 14px' }}>{editing} 채널 프로필키 입력</p>
            <span style={label}>카카오 채널 프로필키 (pfId)</span>
            <input style={input} value={senderKeyInput} onChange={(e) => setSenderKeyInput(e.target.value)} placeholder="솔라피 콘솔에서 채널 연동 후 확인" />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button style={btnGhost} onClick={() => setEditing(null)}>취소</button>
              <button style={btn} disabled={saving} onClick={saveSenderKey}>{saving ? '저장 중…' : '저장하고 연동 켜기'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
