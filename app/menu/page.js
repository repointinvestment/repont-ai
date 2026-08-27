'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/session'
import AppHeader from '../components/AppHeader'

const CARDS = {
  chat: {
    icon: '🤖', title: 'AI 자금진단', desc: '정책자금 항목별 분석 · AI 채팅 · 캘린더',
    path: '/chat', accent: '#0B2440', tint: '#E8EEF5',
  },
  customers: {
    icon: '📋', title: '고객관리', desc: '고객 등록 · 조회 · 진행 현황 관리',
    path: '/customers', accent: '#D85A30', tint: '#FAECE7',
  },
  admin: {
    icon: '⚙️', title: '계정 관리', desc: '직원/수강생 계정 목록 확인',
    path: '/admin', accent: '#6A5A8C', tint: '#EFEBF5',
  },
}

// 역할별로 보여줄 메뉴 구성
const ROLE_MENUS = {
  admin: ['chat', 'customers', 'admin'],
  consultant: ['chat', 'customers'],
  student: ['chat'],
}

export default function MenuPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [customerCount, setCustomerCount] = useState(null)

  useEffect(() => {
    const session = getSession()
    if (!session) { router.push('/'); return }
    setUser(session)

    if (session.role !== 'student') {
      fetch('/api/customers', {
        headers: { 'x-consultant-id': session.username, 'x-consultant-role': session.role },
      })
        .then((r) => r.json())
        .then((d) => setCustomerCount((d.customers || []).length))
        .catch(() => {})
    }
  }, [])

  if (!user) return null

  const visibleCards = (ROLE_MENUS[user.role] || []).map((key) => CARDS[key])
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })

  return (
    <div style={{ minHeight: '100vh', background: '#F7F5F0' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@500;700;900&family=Noto+Sans+KR:wght@400;500;600;700&display=swap');`}</style>
      <AppHeader user={user} />

      {/* 히어로 */}
      <div style={{
        background: 'linear-gradient(180deg, #0B2440 0%, #0E2C4C 100%)',
        padding: '48px 24px 64px',
      }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <p style={{
            fontFamily: "'Noto Serif KR', serif", fontSize: 12, letterSpacing: '0.25em',
            color: '#B4923F', fontWeight: 700, margin: '0 0 10px',
          }}>
            {today}
          </p>
          <h1 style={{
            fontFamily: "'Noto Serif KR', serif", fontSize: 'clamp(26px, 4vw, 34px)',
            color: '#FBF7EE', fontWeight: 700, margin: '0 0 10px', lineHeight: 1.4,
          }}>
            {user.name}님, 오늘도 좋은 하루예요 👋
          </h1>
          <p style={{ fontSize: 14, color: '#8FA6C0', margin: 0 }}>
            {user.role === 'student' ? 'AI 자금진단으로 정책자금부터 알아보세요.' : '아래에서 원하시는 메뉴를 선택하세요.'}
            {customerCount !== null && <> · 현재 담당 고객 <strong style={{ color: '#E9C979' }}>{customerCount}명</strong></>}
          </p>
        </div>
      </div>

      {/* 메뉴 카드 */}
      <div style={{ maxWidth: 880, margin: '-36px auto 0', padding: '0 24px 48px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
          {visibleCards.map((card) => (
            <div
              key={card.title}
              onClick={() => router.push(card.path)}
              style={{
                background: '#FBF7EE',
                borderRadius: 16,
                padding: '30px 26px',
                boxShadow: '0 16px 32px rgba(11,36,64,0.18)',
                border: '1px solid #EEE6DA',
                cursor: 'pointer',
              }}
            >
              <div style={{
                width: 52, height: 52, borderRadius: 14, background: card.tint,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, marginBottom: 16,
              }}>
                {card.icon}
              </div>
              <p style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 17, fontWeight: 700, color: '#2A2925', margin: '0 0 6px' }}>
                {card.title}
              </p>
              <p style={{ fontSize: 13, color: '#8A8272', margin: 0, lineHeight: 1.5 }}>{card.desc}</p>
              <p style={{ fontSize: 12, color: card.accent, fontWeight: 700, margin: '14px 0 0' }}>
                바로가기 →
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
