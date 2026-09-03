'use client'

// app/admin/contracts/page.js
// 전체 계약 현황 (대표 전용, 읽기 전용) — 각 컨설턴트가 자기 고객과 맺은 계약을 대표가 한눈에 확인.
// 생성·서명·입금확인은 여기서 안 함(그건 각 컨설턴트가 /contracts에서 자기 고객 건으로 처리).

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/session'
import AppHeader from '../../components/AppHeader'

const STATUS_STYLE = {
  '서명대기': { bg: '#FAEEDA', fg: '#633806' },
  '서명완료': { bg: '#E6F1FB', fg: '#0C447C' },
  '입금확인': { bg: '#E1F5EE', fg: '#085041' },
  '만료': { bg: '#EFEEE9', fg: '#8A8A85' },
  '해지': { bg: '#FAECE7', fg: '#712B13' },
}

export default function AdminContractsOverviewPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [contracts, setContracts] = useState([])

  useEffect(() => {
    const s = getSession()
    if (!s) { router.push('/'); return }
    if (s.role !== 'admin') { router.push('/menu'); return }
    setUser(s)
    fetch('/api/contracts', { headers: { 'x-consultant-id': s.username, 'x-consultant-role': s.role } })
      .then((r) => r.json()).then((d) => setContracts(d.contracts || []))
  }, [])

  if (!user) return null

  const btn = { padding: '7px 12px', borderRadius: 7, border: '1px solid #2A2925', background: '#fff', color: '#2A2925', fontSize: 12, fontWeight: 600, cursor: 'pointer' }

  return (
    <div style={{ minHeight: '100vh', background: '#F7F6F2' }}>
      <AppHeader user={user} />
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '28px 20px 60px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ color: '#1a1a2e', margin: 0 }}>전체 계약 현황</h2>
            <p style={{ fontSize: 13, color: '#8A8A85', margin: '6px 0 0' }}>각 컨설턴트가 자기 고객과 맺은 계약입니다. 생성·서명·입금확인은 해당 컨설턴트가 직접 처리합니다.</p>
          </div>
          <button style={btn} onClick={() => router.push('/menu')}>메뉴로</button>
        </div>

        {contracts.length === 0 && <p style={{ fontSize: 13, color: '#B0AEA5' }}>계약 건이 없습니다.</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {contracts.map((c) => {
            const st = STATUS_STYLE[c.status] || STATUS_STYLE['서명대기']
            return (
              <div key={c.id} style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 14, color: '#2A2925' }}>{c.owner_name || '고객 미지정'} {c.business_name ? `· ${c.business_name}` : ''}</strong>
                  <span style={{ fontSize: 11, color: '#8A8A85' }}>담당 {c.consultant_name || c.consultant_username}</span>
                  <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 999, background: st.bg, color: st.fg, fontWeight: 700 }}>{c.status}</span>
                </div>
                <p style={{ fontSize: 12.5, color: '#5F5E5A', margin: '6px 0 0' }}>
                  {c.fee_amount?.toLocaleString()}원/년{c.fee_structure === 'flat_plus_success' ? ` + 성공보수 ${c.success_fee_pct}%` : ''}
                  {c.start_date && ` · ${c.start_date} ~ ${c.end_date}`}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
