'use client'

// app/settings/kakao/page.js
// 카카오 알림 설정 — 기본은 "연동 신청"(기술 값 필요 없이 회사 기본정보만 제출, 나머지는 대표가 대신 처리).
// 직접 다 할 수 있는 사람은 "직접 입력"으로 전환해서 API 키를 바로 넣어도 됨.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/session'
import AppHeader from '../../components/AppHeader'

const input = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D3D1C7', fontSize: 14, boxSizing: 'border-box' }
const label = { fontSize: 13, color: '#5F5E5A', display: 'block', marginBottom: 6, fontWeight: 600 }
const btn = { padding: '11px 18px', borderRadius: 8, border: 'none', background: '#2A2925', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }
const btnGhost = { ...btn, background: '#fff', color: '#2A2925', border: '1px solid #2A2925' }

const STATUS_LABEL = {
  none: null,
  requested: { text: '연동 신청 접수됨 — 처리 대기 중', bg: '#FAEEDA', fg: '#633806' },
  in_progress: { text: '처리 중 — 곧 연결됩니다', bg: '#E6F1FB', fg: '#0C447C' },
  active: { text: '연동 완료 ✓', bg: '#E1F5EE', fg: '#085041' },
}

export default function KakaoSettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [existing, setExisting] = useState(null)
  const [mode, setMode] = useState('request') // 'request' | 'advanced'
  const [reqForm, setReqForm] = useState({ businessName: '', bizRegNumber: '', phone: '', email: '', note: '' })
  const [advForm, setAdvForm] = useState({ apiKey: '', apiSecret: '', senderKey: '', senderPhone: '', templateId: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const s = getSession()
    if (!s) { router.push('/'); return }
    setUser(s)
    load(s)
  }, [])

  async function load(s) {
    const d = await fetch('/api/consultant/messaging-config', { headers: { 'x-consultant-id': s.username } }).then((r) => r.json())
    if (d.config) {
      setExisting(d.config)
      setReqForm({ businessName: d.config.requestBusinessName, bizRegNumber: d.config.requestBizRegNumber, phone: d.config.requestPhone, email: d.config.requestEmail, note: d.config.requestNote })
      setAdvForm((f) => ({ ...f, apiKey: d.config.apiKey, senderKey: d.config.senderKey, senderPhone: d.config.senderPhone, templateId: d.config.templateId }))
    }
  }

  async function submitRequest() {
    setSaving(true); setError(null); setSaved(false)
    try {
      const res = await fetch('/api/consultant/messaging-config/request', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-consultant-id': user.username },
        body: JSON.stringify(reqForm),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || '신청 실패')
      setSaved(true)
      await load(user)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function saveAdvanced() {
    setSaving(true); setError(null); setSaved(false)
    try {
      const res = await fetch('/api/consultant/messaging-config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-consultant-id': user.username },
        body: JSON.stringify(advForm),
      })
      if (!res.ok) throw new Error('저장 실패')
      setSaved(true)
      setAdvForm((f) => ({ ...f, apiSecret: '' }))
      await load(user)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null
  const statusBadge = existing?.requestStatus ? STATUS_LABEL[existing.requestStatus] : null

  return (
    <div style={{ minHeight: '100vh', background: '#F7F6F2' }}>
      <AppHeader user={user} />
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '28px 20px 60px' }}>
        <h2 style={{ color: '#1a1a2e', margin: '0 0 4px' }}>카카오 알림 설정</h2>
        <p style={{ fontSize: 13, color: '#8A8A85', margin: '0 0 16px', lineHeight: 1.6 }}>
          내 고객한테 정책자금 안내를 카카오톡으로 보낼 수 있게 연결합니다. 복잡한 설정은 아래 정보만 내시면 저희가 대신 처리해드려요.
        </p>

        {statusBadge && (
          <div style={{ display: 'inline-block', padding: '5px 12px', borderRadius: 20, background: statusBadge.bg, color: statusBadge.fg, fontSize: 12.5, fontWeight: 700, marginBottom: 16 }}>
            {statusBadge.text}
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          <button onClick={() => setMode('request')} style={mode === 'request' ? btn : btnGhost}>간편 신청 (추천)</button>
          <button onClick={() => setMode('advanced')} style={mode === 'advanced' ? btn : btnGhost}>직접 입력 (이미 솔라피 있음)</button>
        </div>

        {mode === 'request' ? (
          <div style={{ background: '#fff', borderRadius: 14, padding: 22, boxShadow: '0 2px 12px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 12.5, color: '#8A8A85', margin: 0 }}>아래 정보만 주시면 카카오 채널 개설부터 솔라피 연동, 템플릿 심사까지 저희가 대신 진행합니다. 채널 개설 시 본인 확인 절차(휴대폰 인증 등)만 별도로 안내드려요.</p>
            <div>
              <span style={label}>상호명(카카오 채널명으로 쓸 이름) *</span>
              <input style={input} value={reqForm.businessName} onChange={(e) => setReqForm({ ...reqForm, businessName: e.target.value })} />
            </div>
            <div>
              <span style={label}>사업자등록번호 (없으면 비워두세요)</span>
              <input style={input} value={reqForm.bizRegNumber} onChange={(e) => setReqForm({ ...reqForm, bizRegNumber: e.target.value })} />
            </div>
            <div>
              <span style={label}>연락처 *</span>
              <input style={input} value={reqForm.phone} onChange={(e) => setReqForm({ ...reqForm, phone: e.target.value })} placeholder="본인 인증 절차 안내드릴 연락처" />
            </div>
            <div>
              <span style={label}>이메일</span>
              <input style={input} value={reqForm.email} onChange={(e) => setReqForm({ ...reqForm, email: e.target.value })} />
            </div>
            <div>
              <span style={label}>메모 (선택)</span>
              <textarea style={{ ...input, minHeight: 60 }} value={reqForm.note} onChange={(e) => setReqForm({ ...reqForm, note: e.target.value })} />
            </div>
            {error && <p style={{ color: '#C0392B', fontSize: 13, margin: 0 }}>{error}</p>}
            {saved && <p style={{ color: '#085041', fontSize: 13, margin: 0 }}>✓ 신청이 접수되었습니다. 처리되면 알려드릴게요.</p>}
            <button onClick={submitRequest} disabled={saving} style={btn}>{saving ? '신청 중…' : '연동 신청'}</button>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 14, padding: 22, boxShadow: '0 2px 12px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 12.5, color: '#8A8A85', margin: 0 }}>이미 솔라피 계정과 카카오 채널·템플릿이 있으면 발급받은 키를 바로 입력하세요.</p>
            <div>
              <span style={label}>API Key</span>
              <input style={input} value={advForm.apiKey} onChange={(e) => setAdvForm({ ...advForm, apiKey: e.target.value })} />
            </div>
            <div>
              <span style={label}>API Secret {existing?.hasApiSecret && <span style={{ color: '#B0AEA5', fontWeight: 400 }}>(연결됨: {existing.apiSecretMasked})</span>}</span>
              <input style={input} type="password" value={advForm.apiSecret} onChange={(e) => setAdvForm({ ...advForm, apiSecret: e.target.value })} placeholder={existing?.hasApiSecret ? '변경하려면 새로 입력' : 'API Secret'} />
            </div>
            <div>
              <span style={label}>카카오 채널 프로필키 (pfId)</span>
              <input style={input} value={advForm.senderKey} onChange={(e) => setAdvForm({ ...advForm, senderKey: e.target.value })} />
            </div>
            <div>
              <span style={label}>발신번호 (선택)</span>
              <input style={input} value={advForm.senderPhone} onChange={(e) => setAdvForm({ ...advForm, senderPhone: e.target.value })} />
            </div>
            <div>
              <span style={label}>알림톡 템플릿 ID</span>
              <input style={input} value={advForm.templateId} onChange={(e) => setAdvForm({ ...advForm, templateId: e.target.value })} />
            </div>
            {error && <p style={{ color: '#C0392B', fontSize: 13, margin: 0 }}>{error}</p>}
            {saved && <p style={{ color: '#085041', fontSize: 13, margin: 0 }}>✓ 저장했습니다.</p>}
            <button onClick={saveAdvanced} disabled={saving} style={btn}>{saving ? '저장 중…' : '저장'}</button>
          </div>
        )}

        <p style={{ fontSize: 11, color: '#B0AEA5', margin: '16px 0 0' }}>
          * API Secret은 암호화해서 저장되고 화면에 다시 평문으로 표시되지 않습니다. 발송 비용은 솔라피에 본인 명의로 결제됩니다.
        </p>
      </div>
    </div>
  )
}
