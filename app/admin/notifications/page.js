'use client'

// app/admin/notifications/page.js
// 머니콕 발송 현황 — 관리자 전용. 전체/컨설턴트별 발송량·성공률과 최근 로그를 한눈에.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/session'
import AppHeader from '../../components/AppHeader'

const STATUS_STYLE = {
  sent: { text: '발송됨', bg: '#E1F5EE', fg: '#085041' },
  failed: { text: '실패', bg: '#FAECE7', fg: '#712B13' },
  pending: { text: '대기', bg: '#FAEEDA', fg: '#633806' },
}

function StatCard({ label, value, accent }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
      <p style={{ fontSize: 12, color: '#8A8A85', margin: '0 0 6px' }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 800, margin: 0, color: accent || '#2A2925' }}>{value}</p>
    </div>
  )
}

export default function NotificationsAdminPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const s = getSession()
    if (!s) { router.push('/'); return }
    if (s.role !== 'admin') { router.push('/menu'); return }
    setUser(s)
    fetch('/api/admin/notification-stats', { headers: { 'x-consultant-id': s.username, 'x-consultant-role': s.role } })
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (!user) return null

  const t = data?.totals
  const successRate = t && Number(t.total) > 0 ? Math.round((Number(t.sent) / Number(t.total)) * 100) : null

  return (
    <div style={{ minHeight: '100vh', background: '#F7F6F2' }}>
      <AppHeader user={user} />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 20px 60px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ color: '#1a1a2e', margin: 0 }}>머니콕 발송 현황</h2>
            <p style={{ fontSize: 13, color: '#8A8A85', margin: '6px 0 0' }}>카카오 알림 전체 발송량과 컨설턴트별 현황입니다.</p>
          </div>
          <button onClick={() => router.push('/menu')} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid #2A2925', background: '#fff', color: '#2A2925', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>메뉴로</button>
        </div>

        {loading ? (
          <p style={{ fontSize: 13, color: '#B0AEA5' }}>불러오는 중...</p>
        ) : !t || Number(t.total) === 0 ? (
          <p style={{ fontSize: 13, color: '#B0AEA5' }}>아직 발송 기록이 없습니다. 카카오 알림이 나가기 시작하면 여기 쌓입니다.</p>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
              <StatCard label="전체 발송" value={t.total} />
              <StatCard label="성공" value={t.sent} accent="#085041" />
              <StatCard label="실패" value={t.failed} accent="#712B13" />
              <StatCard label="오늘" value={t.today} />
              <StatCard label="성공률" value={successRate != null ? `${successRate}%` : '-'} />
            </div>

            <p style={{ fontSize: 14, fontWeight: 700, color: '#2A2925', margin: '24px 0 10px' }}>컨설턴트별 현황</p>
            <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.05)', overflow: 'hidden', marginBottom: 24 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8F7F4' }}>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, color: '#5F5E5A' }}>컨설턴트</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12, color: '#5F5E5A' }}>전체</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12, color: '#5F5E5A' }}>성공</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12, color: '#5F5E5A' }}>실패</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, color: '#5F5E5A' }}>최근 발송</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.byConsultant || []).map((c, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #F0EFEA' }}>
                      <td style={{ padding: '10px 16px', fontSize: 13 }}>{c.consultant_name || c.consultant_id || '미지정'}</td>
                      <td style={{ padding: '10px 16px', fontSize: 13, textAlign: 'right' }}>{c.total}</td>
                      <td style={{ padding: '10px 16px', fontSize: 13, textAlign: 'right', color: '#085041' }}>{c.sent}</td>
                      <td style={{ padding: '10px 16px', fontSize: 13, textAlign: 'right', color: c.failed > 0 ? '#712B13' : '#B0AEA5' }}>{c.failed}</td>
                      <td style={{ padding: '10px 16px', fontSize: 12, color: '#8A8A85' }}>{c.last_sent_at ? new Date(c.last_sent_at).toLocaleString('ko-KR') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.failureReasons?.length > 0 && (
              <>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#2A2925', margin: '0 0 10px' }}>실패 사유</p>
                <div style={{ background: '#fff', borderRadius: 12, padding: '14px 18px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', marginBottom: 24 }}>
                  {data.failureReasons.map((f, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < data.failureReasons.length - 1 ? '1px solid #F0EFEA' : 'none' }}>
                      <span style={{ fontSize: 13, color: '#5F5E5A' }}>{f.error}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#712B13' }}>{f.count}건</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <p style={{ fontSize: 14, fontWeight: 700, color: '#2A2925', margin: '0 0 10px' }}>최근 발송 로그 (최근 50건)</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(data.recent || []).map((r) => {
                const st = STATUS_STYLE[r.status] || STATUS_STYLE.pending
                return (
                  <div key={r.id} style={{ background: '#fff', borderRadius: 10, padding: '10px 14px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, color: '#2A2925' }}>
                        <strong>{r.owner_name || '이름 미입력'}</strong>{r.business_name ? ` · ${r.business_name}` : ''}
                        <span style={{ color: '#8A8A85' }}> — 담당 {r.consultant_name || r.consultant_id || '-'}</span>
                      </span>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: st.bg, color: st.fg, fontWeight: 700, flexShrink: 0 }}>{st.text}</span>
                    </div>
                    <p style={{ fontSize: 12, color: '#5F5E5A', margin: '4px 0 0' }}>{r.message}</p>
                    {r.error && <p style={{ fontSize: 11.5, color: '#B24A2B', margin: '2px 0 0' }}>사유: {r.error}</p>}
                    <p style={{ fontSize: 11, color: '#B0AEA5', margin: '4px 0 0' }}>{new Date(r.created_at).toLocaleString('ko-KR')} · {r.sent_by === 'cron' ? '자동발송' : `${r.sent_by || '-'} 발송`}</p>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
