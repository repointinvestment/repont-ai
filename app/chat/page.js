'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import PolicyFundAnalyzer from '../components/PolicyFundAnalyzer'
import BizCalendar from '../components/BizCalendar'
import { getSession, clearSession } from '@/lib/session'

// 자유 텍스트로 저장된 고객 업종을, AI 진단 폼의 고정 업종 목록 중 가장 가까운 항목으로 매칭
function matchIndustryOption(industryText) {
  if (!industryText) return ''
  const text = industryText
  const map = [
    { keywords: ['음식', '요식', '카페', '외식'], option: '음식점·카페 (요식업)' },
    { keywords: ['도소매', '유통', '판매', '소매', '도매'], option: '도소매업' },
    { keywords: ['제조'], option: '제조업' },
    { keywords: ['건설'], option: '건설업' },
    { keywords: ['운수'], option: '운수업' },
    { keywords: ['서비스', '미용', '세탁', '수선'], option: '서비스업 (미용·세탁·수선 등)' },
    { keywords: ['정보통신', 'IT', '소프트웨어', '컨설팅'], option: '정보통신업 (IT)' },
    { keywords: ['교육'], option: '교육서비스업' },
    { keywords: ['부동산'], option: '부동산업' },
    { keywords: ['농업', '수산', '임업', '농·수·임'], option: '농·수·임업' },
  ]
  const found = map.find(({ keywords }) => keywords.some((k) => text.includes(k)))
  return found ? found.option : '기타'
}

function ChatPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState(null)
  const [tab, setTab] = useState('form')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [analyzerInitialData, setAnalyzerInitialData] = useState(null)
  const [linkedCustomerName, setLinkedCustomerName] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    const u = getSession()
    if (!u) { router.push('/'); return }
    setUser(u)
    setMessages([{ role: 'assistant', content: `안녕하세요 ${u.name}님! 👋\n\n고객 정보를 입력해주시면 맞는 정책자금을 분석해드립니다.\n\n예시: "음식점업, 업력 3년, 작년 매출 8천만원, 신용점수 720점, 기대출 없음, 직원 없음"` }])

    const customerId = searchParams.get('customerId')
    if (customerId) {
      fetch(`/api/customers/${customerId}`)
        .then((r) => r.json())
        .then((data) => {
          const c = data.customer
          if (!c) return
          setLinkedCustomerName(c.owner_name || c.business_name || '')
          const pfd = c.policy_fund_details || {}
          setAnalyzerInitialData({
            industry: matchIndustryOption(c.industry),
            bizAge: c.business_age_years ? String(c.business_age_years) : '',
            sales: c.revenue_amount ? String(c.revenue_amount) : '',
            employees: c.employee_count ? String(c.employee_count) : '',
            creditKCB: c.credit_kcb ? String(c.credit_kcb) : '',
            creditNICE: c.credit_nice ? String(c.credit_nice) : '',
            sojingongLoans: pfd.sojingongLoans || undefined,
            loans: pfd.loans || undefined,
            hasBankruptcy: pfd.hasBankruptcy || '',
            currentBizCount: pfd.currentBizCount || '',
            smartDevices: pfd.smartDevices || [],
            exportRecord: pfd.exportRecord || '',
            salesGrowth: pfd.salesGrowth || '',
            taxDelinquent: pfd.taxDelinquent || '',
            hasPatent: c.has_patent ? 'yes' : '',
            careerYears: c.owner_career_years ? String(c.owner_career_years) : '',
            isFranchise: !!pfd.isFranchise,
          })
        })
        .catch(() => {})
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleAIAnalysis = async (customerSummary) => {
    setTab('chat')
    const msg = `아래 고객 정보를 바탕으로 심층 분석해주세요:\n\n${customerSummary}`
    const userMsg = { role: 'user', content: msg }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setLoading(true)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: newMessages.filter((m, i) => i > 0) })
    })
    const data = await res.json()
    setMessages([...newMessages, { role: 'assistant', content: data.reply }])
    setLoading(false)
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userMsg = { role: 'user', content: input }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: newMessages.filter((m, i) => i > 0) })
    })
    const data = await res.json()
    setMessages([...newMessages, { role: 'assistant', content: data.reply }])
    setLoading(false)
  }

  const handleLogout = () => {
    clearSession()
    router.push('/')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  if (!user) return null

  const NAV_TABS = [
    { key: 'form',     label: '📋 항목별 분석' },
    { key: 'chat',     label: '💬 AI 채팅 분석' },
    { key: 'calendar', label: '📅 캘린더' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f5f5f5' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@500;700;900&family=Noto+Sans+KR:wght@400;500;600;700&display=swap');`}</style>
      {/* 헤더 */}
      <div style={{ background: '#0B2440', color: '#FBF7EE', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.25)', flexShrink: 0, borderBottom: '1px solid #1C3A5C' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }} onClick={() => router.push('/menu')}>
          <span style={{ fontWeight: 700, fontSize: 16, fontFamily: "'Noto Serif KR', serif" }}>💼 자금비서</span>
          <span style={{ fontSize: 13, opacity: 0.65 }}>정책자금 분석 시스템</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 13, opacity: 0.85 }}>{user.name}</span>
          {user.role === 'admin' && (
            <button onClick={() => router.push('/admin')} style={{ background: 'rgba(251,247,238,0.12)', color: '#FBF7EE', border: '1px solid rgba(180,146,63,0.4)', borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}>관리자</button>
          )}
          <button onClick={handleLogout} style={{ background: 'rgba(251,247,238,0.08)', color: '#FBF7EE', border: '1px solid rgba(251,247,238,0.2)', borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}>로그아웃</button>
        </div>
      </div>

      {/* 상단 탭 */}
      <div style={{ background: '#0E2C4C', borderBottom: '1px solid #1C3A5C', display: 'flex', flexShrink: 0 }}>
        {NAV_TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '12px 24px', border: 'none', background: 'none',
            fontSize: 14, fontWeight: tab === key ? 700 : 500,
            color: tab === key ? '#E9C979' : 'rgba(251,247,238,0.55)',
            borderBottom: tab === key ? '2px solid #B4923F' : '2px solid transparent',
            cursor: 'pointer', fontFamily: "'Noto Sans KR', sans-serif",
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* 캘린더 탭 */}
      {tab === 'calendar' && (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <BizCalendar />
        </div>
      )}

      {/* 항목별 분석 탭 */}
      {tab === 'form' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {linkedCustomerName && (
            <div style={{ maxWidth: 800, margin: '16px auto 0', padding: '10px 16px', background: '#E1F5EE', color: '#085041', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
              ✅ {linkedCustomerName} 고객님의 정보를 불러왔습니다. 비어있는 항목은 확인 후 채워주세요.
            </div>
          )}
          <PolicyFundAnalyzer onAIAnalysis={handleAIAnalysis} initialData={analyzerInitialData} />
        </div>
      )}

      {/* AI 채팅 탭 */}
      {tab === 'chat' && (
        <>
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {msg.role === 'assistant' && (
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#0f3460', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, marginRight: 8, flexShrink: 0, marginTop: 4 }}>AI</div>
                )}
                <div style={{
                  maxWidth: '72%', padding: '12px 16px',
                  borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: msg.role === 'user' ? '#0f3460' : 'white',
                  color: msg.role === 'user' ? 'white' : '#222',
                  fontSize: 14, lineHeight: 1.7,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.08)', whiteSpace: 'pre-wrap'
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#0f3460', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>AI</div>
                <div style={{ background: 'white', padding: '12px 16px', borderRadius: '18px 18px 18px 4px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', color: '#888', fontSize: 14 }}>분석 중...</div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div style={{ background: 'white', padding: '16px 24px', boxShadow: '0 -2px 8px rgba(0,0,0,0.06)', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 10, maxWidth: 900, margin: '0 auto' }}>
              <textarea
                value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                placeholder="고객 정보를 입력하세요 (Enter로 전송, Shift+Enter 줄바꿈)"
                rows={2}
                style={{ flex: 1, padding: '12px 14px', border: '1.5px solid #e0e0e0', borderRadius: 10, fontSize: 14, resize: 'none', outline: 'none', fontFamily: 'inherit' }}
              />
              <button onClick={sendMessage} disabled={loading || !input.trim()} style={{
                padding: '0 24px',
                background: loading || !input.trim() ? '#ccc' : '#0f3460',
                color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer'
              }}>
                전송
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatPageInner />
    </Suspense>
  )
}
