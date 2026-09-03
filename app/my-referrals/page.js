'use client'

// app/my-referrals/page.js
// 내가 문수환 대표에게 보낸 의뢰 이력 — 본인 것만 보이고 다른 컨설턴트/수강생 것은 안 보임(서버에서 created_by로 필터).
// 대표가 admin/referrals에서 남긴 답변(admin_note)도 여기서 확인 가능.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/session'
import AppHeader from '../components/AppHeader'

const STATUS_STYLE = {
  '대기': { bg: '#FAECE7', fg: '#712B13' },
  '처리중': { bg: '#FAEEDA', fg: '#633806' },
  '완료': { bg: '#E1F5EE', fg: '#085041' },
}

export default function MyReferralsPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [referrals, setReferrals] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const s = getSession()
    if (!s) { router.push('/'); return }
    setUser(s)
    fetch('/api/referrals/mine', { headers: { 'x-consultant-id': s.username, 'x-consultant-role': s.role } })
      .then((r) => r.json())
      .then((d) => setReferrals(d.referrals || []))
      .finally(() => setLoading(false))
  }, [])

  if (!user) return null

  return (
    <div style={{ minHeight: '100vh', background: '#F7F6F2' }}>
      <AppHeader user={user} />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 20px 60px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ color: '#1a1a2e', margin: 0 }}>내 의뢰 이력</h2>
            <p style={{ fontSize: 13, color: '#8A8A85', margin: '6px 0 0' }}>내가 문수환 대표에게 보낸 의뢰와 답변입니다. 다른 사람 것은 보이지 않습니다.</p>
          </div>
          <button onClick={() => router.push('/menu')} style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid #2A2925', background: '#fff', color: '#2A2925', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>메뉴로</button>
        </div>

        {!loading && referrals.length === 0 && <p style={{ fontSize: 13, color: '#B0AEA5' }}>아직 보낸 의뢰가 없습니다. 고객 상세 화면에서 "문수환 대표에게 의뢰" 버튼으로 보낼 수 있어요.</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {referrals.map((r) => {
            const st = STATUS_STYLE[r.status] || STATUS_STYLE['대기']
            return (
              <div key={r.id} style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 14.5, color: '#2A2925', cursor: 'pointer' }} onClick={() => router.push(`/customers/${r.customer_id}`)}>
                    {r.owner_name || '이름 미입력'} {r.business_name ? `· ${r.business_name}` : ''}
                  </strong>
                  <span style={{ fontSize: 11.5, padding: '2px 9px', borderRadius: 999, background: '#E6F1FB', color: '#0C447C', fontWeight: 700 }}>{r.issue_type}</span>
                  <span style={{ fontSize: 11.5, padding: '2px 9px', borderRadius: 999, background: st.bg, color: st.fg, fontWeight: 700 }}>{r.status}</span>
                </div>
                {r.note && <p style={{ fontSize: 13, color: '#2A2925', margin: '10px 0 0' }}>{r.note}</p>}
                <p style={{ fontSize: 11, color: '#B0AEA5', margin: '8px 0 0' }}>{new Date(r.created_at).toLocaleString('ko-KR')}</p>
                {r.admin_note ? (
                  <div style={{ marginTop: 12, padding: '12px 14px', background: '#F7F5F0', borderRadius: 10, borderLeft: '3px solid #2A2925' }}>
                    <p style={{ fontSize: 11.5, fontWeight: 700, color: '#5F5E5A', margin: '0 0 4px' }}>문수환 대표 답변</p>
                    <p style={{ fontSize: 13, color: '#2A2925', margin: 0, whiteSpace: 'pre-wrap' }}>{r.admin_note}</p>
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: '#B0AEA5', margin: '10px 0 0' }}>아직 답변 대기 중입니다.</p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
