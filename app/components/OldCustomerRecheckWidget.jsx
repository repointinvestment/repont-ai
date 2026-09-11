'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// app/components/OldCustomerRecheckWidget.jsx
// 구DB 관리시스템 — 완료·부결 상관없이 저장된 고객 전체를 다시 판정해서, 예전엔 안 됐는데
// 지금은 새로 접수 가능해진 자금이 있으면 알려줌. 반자동: 여기서 컨설턴트가 확인하고
// "카카오 알림 보내기"를 직접 눌러야 고객에게 나감(자동발송 아님, 수신동의한 고객만).

export default function OldCustomerRecheckWidget({ user }) {
  const router = useRouter()
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(null)
  const [sentIds, setSentIds] = useState({})

  useEffect(() => {
    if (!user) { setLoading(false); return }
    fetch('/api/customers/recheck', { method: 'POST', headers: { 'x-consultant-id': user.username, 'x-consultant-role': user.role } })
      .then((r) => r.json())
      .then((d) => setResults(d.results || []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false))
  }, [user])

  async function sendKakao(r, fundName) {
    setSending(`${r.customerId}-${fundName}`)
    try {
      const res = await fetch(`/api/customers/${r.customerId}/send-kakao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-consultant-id': user.username, 'x-consultant-role': user.role },
        body: JSON.stringify({ fundName }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || '발송 실패')
      setSentIds((s) => ({ ...s, [`${r.customerId}-${fundName}`]: true }))
    } catch (e) {
      alert(e.message)
    } finally {
      setSending(null)
    }
  }

  if (loading || results.length === 0) return null

  return (
    <div style={{
      background: '#FBF7EE', borderRadius: 16, padding: '22px 26px',
      boxShadow: '0 16px 32px rgba(11,36,64,0.18)', border: '1px solid #EEE6DA',
      marginTop: 18,
    }}>
      <p style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 15, fontWeight: 700, color: '#2A2925', margin: '0 0 4px' }}>
        🗂 구DB 재검토 — 새로 맞는 자금이 생긴 고객
      </p>
      <p style={{ fontSize: 11.5, color: '#8A8272', margin: '0 0 14px' }}>완료·부결 상관없이 전체 고객 다시 판정한 결과입니다. 확인 후 직접 알림을 보내세요.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {results.slice(0, 8).map((r) => (
          <div key={r.customerId} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #E4E2DB' }}>
            <div onClick={() => router.push(`/customers/${r.customerId}`)} style={{ cursor: 'pointer', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#2A2925' }}>{r.ownerName || '이름 미입력'}</span>
              {r.businessName && <span style={{ fontSize: 12, color: '#8A8272' }}> · {r.businessName}</span>}
              <span style={{ fontSize: 11, color: '#B0AEA5', marginLeft: 6 }}>({r.status})</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {r.newMatches.map((name) => {
                const key = `${r.customerId}-${name}`
                const sent = sentIds[key]
                return (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', borderRadius: 20, padding: '4px 10px' }}>
                    <span style={{ fontSize: 11.5, color: '#2A2925' }}>{name}</span>
                    {sent ? (
                      <span style={{ fontSize: 10.5, color: '#085041', fontWeight: 700 }}>발송됨 ✓</span>
                    ) : r.marketingConsent ? (
                      <button
                        onClick={() => sendKakao(r, name)}
                        disabled={sending === key}
                        style={{ fontSize: 10.5, color: '#0C447C', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, padding: 0 }}
                      >
                        {sending === key ? '전송중…' : '카카오 알림'}
                      </button>
                    ) : (
                      <span style={{ fontSize: 10.5, color: '#B0AEA5' }}>수신동의 없음</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
