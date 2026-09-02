'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// app/components/ContractExpiryWidget.jsx
// 만료 30일 이내(또는 이미 지남)인 연간계약을 메인메뉴에 띄움. 관리자는 전체, 본인은 자기 계약만 대상.

export default function ContractExpiryWidget({ user }) {
  const router = useRouter()
  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    fetch('/api/contracts/reminders?within=30')
      .then((r) => r.json())
      .then((d) => {
        const list = user.role === 'admin' ? (d.contracts || []) : (d.contracts || []).filter((c) => c.consultant_username === user.username)
        setContracts(list)
      })
      .catch(() => setContracts([]))
      .finally(() => setLoading(false))
  }, [user])

  if (loading || contracts.length === 0) return null

  const daysLeft = (end) => Math.ceil((new Date(end) - new Date()) / (1000 * 60 * 60 * 24))

  return (
    <div style={{
      background: '#FBF7EE', borderRadius: 16, padding: '22px 26px',
      boxShadow: '0 16px 32px rgba(11,36,64,0.18)', border: '1px solid #EEE6DA',
      marginTop: 18,
    }}>
      <p style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 15, fontWeight: 700, color: '#2A2925', margin: '0 0 14px' }}>
        📄 계약 만료 임박
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {contracts.map((c) => {
          const dl = daysLeft(c.end_date)
          return (
            <div key={c.id} onClick={() => router.push(user.role === 'admin' ? '/admin/contracts' : '/contracts')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderRadius: 8, border: '1px solid #E4E2DB', cursor: 'pointer' }}>
              <span style={{ fontSize: 13, color: '#2A2925' }}>{c.consultant_name || c.consultant_username}</span>
              <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 9px', borderRadius: 20, background: dl <= 0 ? '#F5E3DF' : '#FAEEDA', color: dl <= 0 ? '#8A2A1F' : '#633806', flexShrink: 0 }}>
                {dl <= 0 ? '만료됨' : `${dl}일 남음`}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
