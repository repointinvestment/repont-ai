'use client'

// app/notifications/page.js
// 고객 카톡 발송 내역 — 내 고객한테 나간 머니콕 알림을 확인하고, 필요하면 재발송.
// 발송 시점이 컨설턴트마다 다를 수 있어서(자동발송 놓쳤거나 다시 챙기고 싶을 때) 재발송 버튼을 둠.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/session'
import AppHeader from '../components/AppHeader'

const STATUS_STYLE = {
  sent: { text: '발송됨', bg: '#E1F5EE', fg: '#085041' },
  failed: { text: '실패', bg: '#FAECE7', fg: '#712B13' },
  pending: { text: '대기', bg: '#FAEEDA', fg: '#633806' },
}

export default function MyNotificationsPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [resending, setResending] = useState(null)
  const [resentIds, setResentIds] = useState({})
  const [filter, setFilter] = useState('')

  useEffect(() => {
    const s = getSession()
    if (!s) { router.push('/'); return }
    setUser(s)
    load(s)
  }, [])

  async function load(s = user) {
    const d = await fetch('/api/consultant/notifications', { headers: { 'x-consultant-id': s.username, 'x-consultant-role': s.role } }).then((r) => r.json())
    setItems(d.notifications || [])
    setLoading(false)
  }

  async function resend(item) {
    setResending(item.id)
    try {
      const res = await fetch(`/api/notifications/${item.id}/resend`, { method: 'POST', headers: { 'x-consultant-id': user.username, 'x-consultant-role': user.role } })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || '재발송 실패')
      setResentIds((s) => ({ ...s, [item.id]: true }))
      load()
    } catch (e) {
      alert(e.message)
    } finally {
      setResending(null)
    }
  }

  if (!user) return null

  const filtered = filter ? items.filter((i) => i.status === filter) : items

  return (
    <div style={{ minHeight: '100vh', background: '#F7F6F2' }}>
      <AppHeader user={user} />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 20px 60px' }}>
        <h2 style={{ color: '#1a1a2e', margin: '0 0 4px' }}>고객 카톡 발송 내역</h2>
        <p style={{ fontSize: 13, color: '#8A8A85', margin: '0 0 16px' }}>내 고객한테 나간 머니콕 알림입니다. 놓친 것 같으면 재발송하세요.</p>

        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {['', 'sent', 'failed'].map((s) => (
            <button key={s || 'all'} onClick={() => setFilter(s)}
              style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid #D3D1C7', background: filter === s ? '#2A2925' : '#fff', color: filter === s ? '#fff' : '#5F5E5A', fontSize: 12.5, cursor: 'pointer' }}>
              {s === '' ? '전체' : s === 'sent' ? '발송됨' : '실패'} ({s === '' ? items.length : items.filter((i) => i.status === s).length})
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ fontSize: 13, color: '#B0AEA5' }}>불러오는 중...</p>
        ) : filtered.length === 0 ? (
          <p style={{ fontSize: 13, color: '#B0AEA5' }}>발송 내역이 없습니다.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((item) => {
              const st = STATUS_STYLE[item.status] || STATUS_STYLE.pending
              return (
                <div key={item.id} style={{ background: '#fff', borderRadius: 10, padding: '12px 16px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: 13.5, color: '#2A2925', cursor: 'pointer' }} onClick={() => router.push(`/customers/${item.customer_id}`)}>
                          {item.owner_name || '이름 미입력'}
                        </strong>
                        {item.business_name && <span style={{ fontSize: 12, color: '#8A8A85' }}>· {item.business_name}</span>}
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: st.bg, color: st.fg, fontWeight: 700 }}>{st.text}</span>
                      </div>
                      <p style={{ fontSize: 12.5, color: '#5F5E5A', margin: '4px 0 0' }}>{item.message}</p>
                      {item.error && <p style={{ fontSize: 11.5, color: '#B24A2B', margin: '2px 0 0' }}>사유: {item.error}</p>}
                      <p style={{ fontSize: 11, color: '#B0AEA5', margin: '4px 0 0' }}>{new Date(item.created_at).toLocaleString('ko-KR')} · {item.sent_by === 'cron' ? '자동발송' : '수동발송'}</p>
                    </div>
                    <button
                      onClick={() => resend(item)}
                      disabled={resending === item.id}
                      style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid #2A2925', background: resentIds[item.id] ? '#F0EFEA' : '#fff', color: '#2A2925', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}
                    >
                      {resending === item.id ? '전송중…' : resentIds[item.id] ? '재발송됨 ✓' : '재발송'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
