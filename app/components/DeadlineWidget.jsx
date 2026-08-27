'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const POLICY_KEYWORDS = ['이차보전', '자금', '보증', '육성', '융자']

function getDday(endDate) {
  if (!endDate) return null
  const end = new Date(endDate.replace(/-/g, '/'))
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.ceil((end - today) / (1000 * 60 * 60 * 24))
  if (isNaN(diff)) return null
  return diff
}

function isAlwaysOn(item) {
  const raw = item.reqstBeginEndDe || ''
  return raw.includes('예산') || raw.includes('소진') || raw.includes('선착순') || raw.includes('상시')
}

// 메인화면에 띄우는 마감임박 정책자금 공고 미리보기 (최대 4건).
// 전체 캘린더는 AI 자금진단 탭 안 캘린더에서 계속 볼 수 있음.
export default function DeadlineWidget() {
  const router = useRouter()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/bizinfo?category=${encodeURIComponent('금융')}&pageUnit=100`)
      .then((r) => r.json())
      .then((data) => {
        let list = data?.jsonArray || []
        list = Array.isArray(list) ? list : [list]
        list = list.filter((item) => POLICY_KEYWORDS.some((k) => (item.pblancNm || '').includes(k)))

        const withDday = list
          .filter((item) => !isAlwaysOn(item))
          .map((item) => {
            const endDate = item.pbancEndDe || item.reqstEndDe || (item.reqstBeginEndDe ? item.reqstBeginEndDe.split('~')[1]?.trim() : '')
            const dday = getDday(endDate)
            return { ...item, dday }
          })
          .filter((item) => item.dday !== null && item.dday >= 0)
          .sort((a, b) => a.dday - b.dday)
          .slice(0, 4)

        setItems(withDday)
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading || items.length === 0) return null

  return (
    <div style={{
      background: '#FBF7EE', borderRadius: 16, padding: '22px 26px',
      boxShadow: '0 16px 32px rgba(11,36,64,0.18)', border: '1px solid #EEE6DA',
      marginTop: 18,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <p style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 15, fontWeight: 700, color: '#2A2925', margin: 0 }}>
          ⏰ 마감임박 정책자금 공고
        </p>
        <button
          type="button"
          onClick={() => router.push('/chat')}
          style={{ background: 'none', border: 'none', color: '#B4923F', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
        >
          전체보기 →
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((item, i) => {
          const link = item.pblancUrl || item.detailUrl || ''
          return (
            <div
              key={i}
              onClick={() => link && window.open(link, '_blank')}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 8, border: '1px solid #E4E2DB',
                cursor: link ? 'pointer' : 'default',
              }}
            >
              <span style={{
                fontSize: 11, fontWeight: 800, padding: '4px 9px', borderRadius: 20,
                background: item.dday <= 3 ? '#F5E3DF' : '#F6F1E3',
                color: item.dday <= 3 ? '#8A2A1F' : '#8A5A2E',
                flexShrink: 0,
              }}>
                {item.dday === 0 ? 'D-Day' : `D-${item.dday}`}
              </span>
              <span style={{ fontSize: 13, color: '#2A2925', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.pblancNm}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
