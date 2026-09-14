'use client'

// app/settings/kakao/page.js
// 카카오 알림 채널 연동 신청 — 회사 솔라피 계정을 공유해서 쓰기 때문에 컨설턴트는 기술 값을 전혀
// 몰라도 됨. 자기 카카오 채널만 준비해서(안내드림) 기본정보 내고 "연동 신청"만 누르면 끝.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/session'
import AppHeader from '../../components/AppHeader'

const input = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D3D1C7', fontSize: 14, boxSizing: 'border-box' }
const label = { fontSize: 13, color: '#5F5E5A', display: 'block', marginBottom: 6, fontWeight: 600 }
const btn = { padding: '11px 18px', borderRadius: 8, border: 'none', background: '#2A2925', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }

const STATUS_LABEL = {
  none: null,
  requested: { text: '연동 신청 접수됨 — 처리 대기 중', bg: '#FAEEDA', fg: '#633806' },
  in_progress: { text: '처리 중 — 곧 연결됩니다', bg: '#E6F1FB', fg: '#0C447C' },
  active: { text: '연동 완료 ✓ 머니콕으로 알림이 나갈 수 있어요', bg: '#E1F5EE', fg: '#085041' },
}

export default function KakaoSettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [existing, setExisting] = useState(null)
  const [form, setForm] = useState({ businessName: '', bizRegNumber: '', phone: '', email: '', note: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const s = getSession()
    if (!s) { router.push('/'); return }
    setUser(s)
    fetch('/api/consultant/channel-request', { headers: { 'x-consultant-id': s.username } })
      .then((r) => r.json())
      .then((d) => {
        if (d.channel) {
          setExisting(d.channel)
          setForm({
            businessName: d.channel.request_business_name || '', bizRegNumber: d.channel.request_biz_reg_number || '',
            phone: d.channel.request_phone || '', email: d.channel.request_email || '', note: d.channel.request_note || '',
          })
        }
      })
  }, [])

  async function submit() {
    setSaving(true); setError(null); setSaved(false)
    try {
      const res = await fetch('/api/consultant/channel-request', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-consultant-id': user.username },
        body: JSON.stringify(form),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || '신청 실패')
      setSaved(true)
      setExisting(d.channel)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null
  const statusBadge = existing?.request_status ? STATUS_LABEL[existing.request_status] : null

  return (
    <div style={{ minHeight: '100vh', background: '#F7F6F2' }}>
      <AppHeader user={user} />
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '28px 20px 60px' }}>
        <h2 style={{ color: '#1a1a2e', margin: '0 0 4px' }}>카카오 알림(머니콕) 연동 신청</h2>
        <p style={{ fontSize: 13, color: '#8A8A85', margin: '0 0 16px', lineHeight: 1.6 }}>
          내 고객한테 지원금·정책자금 공고 소식을 머니콕 카카오톡으로 보낼 수 있게 연결합니다. 아래 정보만 내시면 채널 연동은 저희가 대신 처리해드려요.
        </p>

        {statusBadge && (
          <div style={{ display: 'inline-block', padding: '5px 12px', borderRadius: 20, background: statusBadge.bg, color: statusBadge.fg, fontSize: 12.5, fontWeight: 700, marginBottom: 16 }}>
            {statusBadge.text}
          </div>
        )}

        <div style={{ background: '#fff', borderRadius: 14, padding: 22, boxShadow: '0 2px 12px rgba(0,0,0,0.05)', marginBottom: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#2A2925', margin: '0 0 8px' }}>미리 준비할 것</p>
          <p style={{ fontSize: 12.5, color: '#5F5E5A', margin: 0, lineHeight: 1.8 }}>
            내 명의(또는 사업체 명의) 카카오톡 채널 하나만 있으면 됩니다 (센터.kakao.com에서 무료 개설, 5분이면 됩니다). 아직 없으면 신청 먼저 넣으셔도 되고, 채널 만드신 뒤에 저희가 연락드려 채널 아이디만 확인하겠습니다.
          </p>
          <p style={{ fontSize: 12.5, color: '#B24A2B', margin: '10px 0 0', fontWeight: 600, lineHeight: 1.7 }}>
            ⚠ 채널 이름은 꼭 본인 이름(예: "문수환" 또는 "문수환 정책자금상담")으로 만들어주세요. 고객 카톡 목록에 그 이름 그대로 발신자로 뜹니다 — "머니콕" 같은 회사 브랜드로 만들면 고객이 "누구지?" 하고 못 알아볼 수 있어요.
          </p>
        </div>

        <div style={{ background: '#fff', borderRadius: 14, padding: 22, boxShadow: '0 2px 12px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <span style={label}>상호명(카카오 채널명으로 쓸 이름) *</span>
            <input style={input} value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
          </div>
          <div>
            <span style={label}>사업자등록번호 (없으면 비워두세요)</span>
            <input style={input} value={form.bizRegNumber} onChange={(e) => setForm({ ...form, bizRegNumber: e.target.value })} />
          </div>
          <div>
            <span style={label}>연락처 *</span>
            <input style={input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="연동 관련 안내드릴 연락처" />
          </div>
          <div>
            <span style={label}>이메일</span>
            <input style={input} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <span style={label}>메모 (선택 — 이미 만든 카카오 채널이 있으면 채널명 적어주세요)</span>
            <textarea style={{ ...input, minHeight: 60 }} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          {error && <p style={{ color: '#C0392B', fontSize: 13, margin: 0 }}>{error}</p>}
          {saved && <p style={{ color: '#085041', fontSize: 13, margin: 0 }}>✓ 신청이 접수되었습니다.</p>}
          <button onClick={submit} disabled={saving} style={btn}>{saving ? '신청 중…' : '연동 신청'}</button>
        </div>
      </div>
    </div>
  )
}
