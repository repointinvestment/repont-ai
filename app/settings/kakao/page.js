'use client'

// app/settings/kakao/page.js
// 카카오 알림 설정 — 컨설턴트 본인이 솔라피 계정을 만들고 발급받은 키를 여기 붙여넣기만 하면
// 자기 고객한테 자기 카카오 채널로 알림이 나가도록 연결. 회사 공용 키가 아니라 각자 자기 것.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/session'
import AppHeader from '../../components/AppHeader'

const input = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D3D1C7', fontSize: 14, boxSizing: 'border-box' }
const label = { fontSize: 13, color: '#5F5E5A', display: 'block', marginBottom: 6, fontWeight: 600 }
const btn = { padding: '11px 18px', borderRadius: 8, border: 'none', background: '#2A2925', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }

export default function KakaoSettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [form, setForm] = useState({ apiKey: '', apiSecret: '', senderKey: '', senderPhone: '', templateId: '' })
  const [existing, setExisting] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const s = getSession()
    if (!s) { router.push('/'); return }
    setUser(s)
    fetch('/api/consultant/messaging-config', { headers: { 'x-consultant-id': s.username } })
      .then((r) => r.json())
      .then((d) => {
        if (d.config) {
          setExisting(d.config)
          setForm((f) => ({ ...f, apiKey: d.config.apiKey, senderKey: d.config.senderKey, senderPhone: d.config.senderPhone, templateId: d.config.templateId }))
        }
      })
  }, [])

  async function save() {
    setSaving(true); setError(null); setSaved(false)
    try {
      const res = await fetch('/api/consultant/messaging-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-consultant-id': user.username },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('저장 실패')
      setSaved(true)
      setForm((f) => ({ ...f, apiSecret: '' })) // 다시 마스킹 상태로
      const d = await fetch('/api/consultant/messaging-config', { headers: { 'x-consultant-id': user.username } }).then((r) => r.json())
      setExisting(d.config)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null

  return (
    <div style={{ minHeight: '100vh', background: '#F7F6F2' }}>
      <AppHeader user={user} />
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '28px 20px 60px' }}>
        <h2 style={{ color: '#1a1a2e', margin: '0 0 4px' }}>카카오 알림 설정</h2>
        <p style={{ fontSize: 13, color: '#8A8A85', margin: '0 0 20px', lineHeight: 1.6 }}>
          내 고객한테 정책자금 안내를 카카오톡으로 보내려면, 내 솔라피 계정의 키를 여기 연결하세요. 회사 전체가 같이 쓰는 게 아니라 컨설턴트별로 각자 연결하는 방식입니다.
        </p>

        <div style={{ background: '#fff', borderRadius: 14, padding: 22, boxShadow: '0 2px 12px rgba(0,0,0,0.05)', marginBottom: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#2A2925', margin: '0 0 8px' }}>준비물 (솔라피 solapi.com 가입 후 발급)</p>
          <ol style={{ fontSize: 12.5, color: '#5F5E5A', margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
            <li>카카오 비즈니스 채널 개설 (센터.kakao.com)</li>
            <li>솔라피 가입 → 카카오 채널 연동 → 채널 프로필키(pfId) 발급</li>
            <li>알림톡 템플릿 등록·심사 신청 → 승인되면 템플릿 ID 발급</li>
            <li>솔라피 콘솔 → API Key/Secret 발급</li>
          </ol>
        </div>

        <div style={{ background: '#fff', borderRadius: 14, padding: 22, boxShadow: '0 2px 12px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <span style={label}>API Key</span>
            <input style={input} value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder="솔라피 콘솔에서 발급받은 API Key" />
          </div>
          <div>
            <span style={label}>API Secret {existing?.hasApiSecret && <span style={{ color: '#B0AEA5', fontWeight: 400 }}>(연결됨: {existing.apiSecretMasked})</span>}</span>
            <input style={input} type="password" value={form.apiSecret} onChange={(e) => setForm({ ...form, apiSecret: e.target.value })} placeholder={existing?.hasApiSecret ? '변경하려면 새로 입력 (그대로 두면 기존 값 유지)' : 'API Secret'} />
          </div>
          <div>
            <span style={label}>카카오 채널 프로필키 (pfId)</span>
            <input style={input} value={form.senderKey} onChange={(e) => setForm({ ...form, senderKey: e.target.value })} placeholder="솔라피 콘솔 카카오 채널 연동 화면에서 확인" />
          </div>
          <div>
            <span style={label}>발신번호 (SMS 대체발송용, 선택)</span>
            <input style={input} value={form.senderPhone} onChange={(e) => setForm({ ...form, senderPhone: e.target.value })} placeholder="예: 0212345678" />
          </div>
          <div>
            <span style={label}>알림톡 템플릿 ID</span>
            <input style={input} value={form.templateId} onChange={(e) => setForm({ ...form, templateId: e.target.value })} placeholder="심사 승인된 템플릿의 ID" />
          </div>

          {error && <p style={{ color: '#C0392B', fontSize: 13, margin: 0 }}>{error}</p>}
          {saved && <p style={{ color: '#085041', fontSize: 13, margin: 0 }}>✓ 저장했습니다.</p>}

          <button onClick={save} disabled={saving} style={btn}>{saving ? '저장 중…' : '저장'}</button>
        </div>

        <p style={{ fontSize: 11, color: '#B0AEA5', margin: '16px 0 0' }}>
          * API Secret은 암호화해서 저장되고 화면에 평문으로 다시 표시되지 않습니다. 발송 비용은 솔라피에 본인 명의로 결제되며 저희 쪽에 별도로 청구되지 않습니다.
        </p>
      </div>
    </div>
  )
}
