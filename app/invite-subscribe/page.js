'use client'

// app/invite-subscribe/page.js
// 신청안내 문자발송 — 내 고객 중 골라서(또는 전체) "정책자금 소식 신청하시겠어요?" 문자를 한 번에 발송.
// 신청(구독)한 고객만 이후 "기존고객_리마인드" 카카오 알림 대상이 됨(카카오 액션 기반 요건 충족용).

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/session'
import AppHeader from '../components/AppHeader'

const btn = { padding: '10px 18px', borderRadius: 8, border: 'none', background: '#2A2925', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }
const btnGhost = { padding: '6px 12px', borderRadius: 7, border: '1px solid #D3D1C7', background: '#fff', color: '#5F5E5A', fontSize: 12, cursor: 'pointer' }

export default function InviteSubscribePage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [customers, setCustomers] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    const s = getSession()
    if (!s) { router.push('/'); return }
    setUser(s)
    fetch('/api/customers', { headers: { 'x-consultant-id': s.username, 'x-consultant-role': s.role } })
      .then((r) => r.json())
      .then((d) => setCustomers((d.customers || []).filter((c) => c.phone)))
      .finally(() => setLoading(false))
  }, [])

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function selectAllUnsubscribed() {
    setSelected(new Set(customers.filter((c) => !c.alert_subscribed_at).map((c) => c.id)))
  }

  async function send() {
    if (selected.size === 0) return
    if (!confirm(`선택한 ${selected.size}명에게 신청안내 문자를 보낼까요?`)) return
    setSending(true); setResult(null)
    try {
      const res = await fetch('/api/customers/invite-subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-consultant-id': user.username, 'x-consultant-role': user.role },
        body: JSON.stringify({ customerIds: [...selected] }),
      })
      const d = await res.json()
      setResult(d)
      setSelected(new Set())
    } finally {
      setSending(false)
    }
  }

  if (!user) return null

  return (
    <div style={{ minHeight: '100vh', background: '#F7F6F2' }}>
      <AppHeader user={user} />
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '28px 20px 60px' }}>
        <h2 style={{ color: '#1a1a2e', margin: '0 0 4px' }}>신청안내 문자발송</h2>
        <p style={{ fontSize: 13, color: '#8A8A85', margin: '0 0 16px', lineHeight: 1.6 }}>
          정책자금 소식 카톡 알림은 고객이 직접 "신청"해야 보낼 수 있어요. 아래 고객을 골라서 신청 안내 문자를 보내면, 그 링크에서 신청한 고객만 앞으로 알림 대상이 됩니다.
        </p>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <button style={btnGhost} onClick={selectAllUnsubscribed}>아직 신청 안 한 고객 전체 선택</button>
          <span style={{ fontSize: 12.5, color: '#5F5E5A' }}>{selected.size}명 선택됨</span>
        </div>

        {result && (
          <div style={{ background: '#fff', borderRadius: 10, padding: '12px 16px', marginBottom: 14, border: '1px solid #E0DFDA' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#085041', margin: 0 }}>✓ {result.sent}명 발송 완료</p>
            {result.failed?.length > 0 && (
              <p style={{ fontSize: 12, color: '#B24A2B', margin: '4px 0 0' }}>실패 {result.failed.length}건: {result.failed.map((f) => f.name).join(', ')}</p>
            )}
          </div>
        )}

        {loading ? (
          <p style={{ fontSize: 13, color: '#B0AEA5' }}>불러오는 중...</p>
        ) : customers.length === 0 ? (
          <p style={{ fontSize: 13, color: '#B0AEA5' }}>연락처가 등록된 고객이 없습니다.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {customers.map((c) => (
              <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', borderRadius: 8, padding: '10px 14px', cursor: 'pointer', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} style={{ width: 16, height: 16 }} />
                <span style={{ fontSize: 13.5, color: '#2A2925', flex: 1 }}>{c.owner_name} <span style={{ color: '#8A8A85', fontSize: 12 }}>{c.business_name ? `· ${c.business_name}` : ''}</span></span>
                {c.alert_subscribed_at ? (
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: '#E1F5EE', color: '#085041', fontWeight: 700 }}>신청됨</span>
                ) : (
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: '#F0EFEA', color: '#8A8A85' }}>미신청</span>
                )}
              </label>
            ))}
          </div>
        )}
      </div>

      {selected.size > 0 && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #E0DFDA', padding: '12px 20px', display: 'flex', justifyContent: 'center' }}>
          <button style={btn} disabled={sending} onClick={send}>{sending ? '발송 중…' : `선택한 ${selected.size}명에게 문자 보내기`}</button>
        </div>
      )}
    </div>
  )
}
