'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/session'
import AppHeader from '../components/AppHeader'

const CARDS = {
  chat: { icon: '🤖', title: 'AI 자금진단', desc: '정책자금 항목별 분석 · AI 채팅 · 캘린더', path: '/chat' },
  customers: { icon: '📋', title: '고객관리', desc: '고객 등록 · 조회 · 진행 현황 관리', path: '/customers' },
  admin: { icon: '⚙️', title: '계정 관리', desc: '직원/수강생 계정 목록 확인', path: '/admin' },
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

  useEffect(() => {
    const session = getSession()
    if (!session) { router.push('/'); return }
    setUser(session)
  }, [])

  if (!user) return null

  const visibleCards = (ROLE_MENUS[user.role] || []).map((key) => CARDS[key])

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <AppHeader user={user} />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: '0 0 4px' }}>
          {user.name}님, 안녕하세요 👋
        </h1>
        <p style={{ fontSize: 14, color: '#888', margin: '0 0 32px' }}>원하시는 메뉴를 선택하세요.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {visibleCards.map((card) => (
            <div
              key={card.title}
              onClick={() => router.push(card.path)}
              style={{
                background: 'white',
                borderRadius: 14,
                padding: '28px 24px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
                cursor: 'pointer',
                transition: 'transform 0.15s',
              }}
            >
              <div style={{ fontSize: 30, marginBottom: 10 }}>{card.icon}</div>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e', margin: '0 0 6px' }}>{card.title}</p>
              <p style={{ fontSize: 13, color: '#888', margin: 0, lineHeight: 1.5 }}>{card.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
