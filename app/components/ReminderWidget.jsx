'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const STALE_DAYS = 7

function daysSince(dateStr) {
  const then = new Date(dateStr)
  const now = new Date()
  return Math.floor((now - then) / (1000 * 60 * 60 * 24))
}

// 완료 단계가 아니면서 STALE_DAYS일 이상 업데이트가 없는 고객을 팔로우업 리마인더로 표시.
export default function ReminderWidget({ user }) {
  const router = useRouter()
  const [stale, setStale] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || user.role === 'student') { setLoading(false); return }
    fetch('/api/customers', {
      headers: { 'x-consultant-id': user.username, 'x-consultant-role': user.role },
    })
      .then((r) => r.json())
      .then((d) => {
        const list = (d.customers || [])
          .filter((c) => (c.status || '상담중') !== '완료')
          .map((c) => ({ ...c, daysStale: daysSince(c.updated_at) }))
          .filter((c) => c.daysStale >= STALE_DAYS)
          .sort((a, b) => b.daysStale - a.daysStale)
          .slice(0, 5)
        setStale(list)
      })
      .catch(() => setStale([]))
      .finally(() => setLoading(false))
  }, [user])

  if (loading || stale.length === 0) return null

  return (
    <div style={{
      background: '#FBF7EE', borderRadius: 16, padding: '22px 26px',
      boxShadow: '0 16px 32px rgba(11,36,64,0.18)', border: '1px solid #EEE6DA',
      marginTop: 18,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <p style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 15, fontWeight: 700, color: '#2A2925', margin: 0 }}>
          📌 팔로우업이 필요해요
        </p>
        <span style={{ fontSize: 12, color: '#8A8272' }}>{STALE_DAYS}일 이상 업데이트 없음</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {stale.map((c) => (
          <div
            key={c.id}
            onClick={() => router.push(`/customers/${c.id}`)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              padding: '10px 12px', borderRadius: 8, border: '1px solid #E4E2DB', cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 13, color: '#2A2925' }}>
              {c.owner_name || '이름 미입력'} {c.business_name ? `· ${c.business_name}` : ''}
              <span style={{ color: '#8A8272' }}> ({c.status || '상담중'})</span>
            </span>
            <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 9px', borderRadius: 20, background: '#F5E3DF', color: '#8A2A1F', flexShrink: 0 }}>
              {c.daysStale}일째
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
