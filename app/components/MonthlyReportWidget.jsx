'use client'
import { useState, useEffect, useRef } from 'react'

const STAGE_STYLE = {
  '상담중': { color: '#D85A30' },
  '서류준비': { color: '#C99A3A' },
  '심사중': { color: '#2E9A6B' },
  '완료': { color: '#3B6FB5' },
}

// 숫자를 0에서 목표값까지 애니메이션으로 카운트업
function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0)
  const startRef = useRef(null)

  useEffect(() => {
    if (target === null || target === undefined) return
    startRef.current = null
    let raf
    function step(ts) {
      if (!startRef.current) startRef.current = ts
      const progress = Math.min((ts - startRef.current) / duration, 1)
      setValue(Math.round(progress * target))
      if (progress < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return value
}

export default function MonthlyReportWidget({ user }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || user.role === 'student') { setLoading(false); return }
    fetch('/api/reports/summary', {
      headers: { 'x-consultant-id': user.username, 'x-consultant-role': user.role },
    })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [user])

  const newCount = useCountUp(data?.newThisMonth)
  const completedCount = useCountUp(data?.completedThisMonth)

  if (loading || !data) return null

  const totalActive = Object.values(data.stageBreakdown).reduce((a, b) => a + b, 0);

  return (
    <div style={{
      background: '#FBF7EE', borderRadius: 16, padding: '24px 26px',
      boxShadow: '0 16px 32px rgba(11,36,64,0.18)', border: '1px solid #EEE6DA',
      marginTop: 18,
    }}>
      <p style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 15, fontWeight: 700, color: '#2A2925', margin: '0 0 18px' }}>
        📊 이번 달 성과
      </p>

      <div style={{ display: 'flex', gap: 16, marginBottom: 22, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 140, textAlign: 'center', padding: '18px 12px', borderRadius: 12, background: '#FAECE7' }}>
          <p style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 34, fontWeight: 900, color: '#D85A30', margin: 0 }}>
            {newCount}
          </p>
          <p style={{ fontSize: 12, color: '#8A5A2E', margin: '4px 0 0', fontWeight: 600 }}>이번 달 신규 상담</p>
        </div>
        <div style={{ flex: 1, minWidth: 140, textAlign: 'center', padding: '18px 12px', borderRadius: 12, background: '#E4EAF1' }}>
          <p style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 34, fontWeight: 900, color: '#3B6FB5', margin: 0 }}>
            {completedCount}
          </p>
          <p style={{ fontSize: 12, color: '#264569', margin: '4px 0 0', fontWeight: 600 }}>이번 달 완료</p>
        </div>
      </div>

      <p style={{ fontSize: 12, color: '#8A8272', margin: '0 0 10px', fontWeight: 600 }}>현재 진행 단계 (총 {totalActive}명)</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Object.entries(data.stageBreakdown).map(([stage, count]) => (
          <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: '#5F5E5A', width: 56, flexShrink: 0 }}>{stage}</span>
            <div style={{ flex: 1, height: 10, background: '#EFE8D6', borderRadius: 20, overflow: 'hidden' }}>
              <div style={{
                width: totalActive > 0 ? `${(count / totalActive) * 100}%` : '0%',
                height: '100%', background: STAGE_STYLE[stage].color, borderRadius: 20,
                transition: 'width 0.8s ease',
              }} />
            </div>
            <span style={{ fontSize: 12, color: '#2A2925', fontWeight: 700, width: 28, textAlign: 'right', flexShrink: 0 }}>{count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
