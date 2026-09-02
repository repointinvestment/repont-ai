'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// app/components/ReapplyReminderWidget.jsx
// 부결된 건 중 재신청 가능 시점이 됐거나(재단·신보·기보 등 기간제) 임박한 것을 메인메뉴에 띄움.
// 소진공처럼 공고 기준(기간 제한 없음)인 건은 별도 묶음으로 — 공고 알림 기능(로드맵 6번) 붙기 전까지는
// "공고 뜨면 다시 확인" 정도로만 표시.

export default function ReapplyReminderWidget({ user }) {
  const router = useRouter()
  const [dated, setDated] = useState([])
  const [announcement, setAnnouncement] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    fetch('/api/applications/reminders?within=14')
      .then((r) => r.json())
      .then((d) => { setDated(d.dated || []); setAnnouncement(d.announcement || []) })
      .catch(() => { setDated([]); setAnnouncement([]) })
      .finally(() => setLoading(false))
  }, [user])

  if (loading || (dated.length === 0 && announcement.length === 0)) return null

  const ready = dated.filter((a) => a.reapply_status === 'ready')
  const waiting = dated.filter((a) => a.reapply_status === 'waiting')

  return (
    <div style={{
      background: '#FBF7EE', borderRadius: 16, padding: '22px 26px',
      boxShadow: '0 16px 32px rgba(11,36,64,0.18)', border: '1px solid #EEE6DA',
      marginTop: 18,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <p style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 15, fontWeight: 700, color: '#2A2925', margin: 0 }}>
          🔁 부결 재신청 알림
        </p>
        {ready.length > 0 && <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 9px', borderRadius: 20, background: '#E1F5EE', color: '#085041' }}>{ready.length}건 가능</span>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[...ready, ...waiting].map((a) => (
          <div
            key={a.id}
            onClick={() => router.push(`/customers/${a.customer_id}`)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              padding: '10px 12px', borderRadius: 8, border: '1px solid #E4E2DB', cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 13, color: '#2A2925' }}>
              {a.owner_name || '이름 미입력'} {a.business_name ? `· ${a.business_name}` : ''}
              <span style={{ color: '#8A8272' }}> — {a.fund_name}</span>
            </span>
            <span style={{
              fontSize: 11, fontWeight: 800, padding: '4px 9px', borderRadius: 20, flexShrink: 0,
              background: a.reapply_status === 'ready' ? '#E1F5EE' : '#F5E3DF',
              color: a.reapply_status === 'ready' ? '#085041' : '#8A2A1F',
            }}>
              {a.reapply_status === 'ready' ? '지금 가능' : String(a.reapply_available_at).slice(0, 10)}
            </span>
          </div>
        ))}
        {announcement.length > 0 && (
          <div style={{ marginTop: 4, paddingTop: 10, borderTop: '1px dashed #E4E2DB' }}>
            <p style={{ fontSize: 11.5, color: '#8A8272', margin: '0 0 8px' }}>공고 뜨면 재도전 (소진공 등 기간 제한 없음, {announcement.length}건)</p>
            {announcement.slice(0, 3).map((a) => (
              <div key={a.id} onClick={() => router.push(`/customers/${a.customer_id}`)} style={{ fontSize: 12.5, color: '#5F5E5A', padding: '4px 0', cursor: 'pointer' }}>
                • {a.owner_name || '이름 미입력'} — {a.fund_name}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
