'use client'

// app/admin/materials/page.js
// 전체 안내자료 현황(관리자 전용) — 컨설턴트별로 뭘 만들었고 문의가 몇 건 왔는지. 성과 관리용.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/session'
import AppHeader from '../../components/AppHeader'

const btnGhost = { padding: '9px 14px', borderRadius: 8, border: '1px solid #2A2925', background: '#fff', color: '#2A2925', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }

export default function AdminMaterialsPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('inquiry'); // 'inquiry' | 'recent'

  useEffect(() => {
    const s = getSession()
    if (!s) { router.push('/'); return }
    if (s.role !== 'admin') { router.push('/menu'); return }
    setUser(s)
    fetch('/api/admin/materials', { headers: { 'x-consultant-id': s.username, 'x-consultant-role': s.role } })
      .then((r) => r.json())
      .then((d) => setMaterials(d.materials || []))
      .finally(() => setLoading(false))
  }, [])

  if (!user) return null

  // 컨설턴트별 집계
  const byConsultant = {}
  for (const m of materials) {
    const key = m.consultant_username
    if (!byConsultant[key]) byConsultant[key] = { name: m.consultant_name || key, count: 0, inquiries: 0 }
    byConsultant[key].count += 1
    byConsultant[key].inquiries += m.inquiry_count
  }
  const consultantStats = Object.values(byConsultant).sort((a, b) => b.inquiries - a.inquiries)

  const sorted = [...materials].sort((a, b) => sortBy === 'inquiry' ? b.inquiry_count - a.inquiry_count : new Date(b.updated_at) - new Date(a.updated_at))

  return (
    <div style={{ minHeight: '100vh', background: '#F7F6F2' }}>
      <AppHeader user={user} />
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '28px 20px 60px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ color: '#1a1a2e', margin: 0 }}>전체 안내자료 현황</h2>
            <p style={{ fontSize: 13, color: '#8A8A85', margin: '6px 0 0' }}>컨설턴트가 만든 자료와 문의 건수입니다.</p>
          </div>
          <button style={btnGhost} onClick={() => router.push('/menu')}>메뉴로</button>
        </div>

        {loading ? (
          <p style={{ fontSize: 13, color: '#B0AEA5' }}>불러오는 중...</p>
        ) : materials.length === 0 ? (
          <p style={{ fontSize: 13, color: '#B0AEA5' }}>아직 만든 자료가 없습니다.</p>
        ) : (
          <>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#2A2925', margin: '0 0 10px' }}>컨설턴트별 성과</p>
            <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.05)', overflow: 'hidden', marginBottom: 24 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8F7F4' }}>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, color: '#5F5E5A' }}>컨설턴트</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12, color: '#5F5E5A' }}>만든 자료 수</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12, color: '#5F5E5A' }}>총 문의 수</th>
                  </tr>
                </thead>
                <tbody>
                  {consultantStats.map((c, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #F0EFEA' }}>
                      <td style={{ padding: '10px 16px', fontSize: 13 }}>{c.name}</td>
                      <td style={{ padding: '10px 16px', fontSize: 13, textAlign: 'right' }}>{c.count}</td>
                      <td style={{ padding: '10px 16px', fontSize: 13, textAlign: 'right', fontWeight: 700, color: c.inquiries > 0 ? '#085041' : '#B0AEA5' }}>{c.inquiries}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#2A2925', margin: 0 }}>전체 자료 목록</p>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setSortBy('inquiry')} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #D3D1C7', background: sortBy === 'inquiry' ? '#2A2925' : '#fff', color: sortBy === 'inquiry' ? '#fff' : '#5F5E5A', fontSize: 11.5, cursor: 'pointer' }}>문의 많은 순</button>
                <button onClick={() => setSortBy('recent')} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #D3D1C7', background: sortBy === 'recent' ? '#2A2925' : '#fff', color: sortBy === 'recent' ? '#fff' : '#5F5E5A', fontSize: 11.5, cursor: 'pointer' }}>최신순</button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sorted.map((m) => (
                <div key={m.id} style={{ background: '#fff', borderRadius: 10, padding: '12px 16px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <div>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: '#2A2925', cursor: 'pointer' }} onClick={() => window.open(`/m/${m.id}`, '_blank')}>{m.title}</span>
                    <span style={{ fontSize: 11.5, color: '#8A8A85', marginLeft: 8 }}>{m.consultant_name || m.consultant_username}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: m.inquiry_count > 0 ? '#085041' : '#B0AEA5' }}>문의 {m.inquiry_count}건</span>
                    <button
                      onClick={async () => {
                        await fetch(`/api/materials/${m.id}/clone`, { method: 'POST', headers: { 'x-consultant-id': user.username, 'x-consultant-role': user.role } })
                        alert('내 "안내자료 만들기" 목록에 복사본이 추가됐습니다.')
                      }}
                      style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #2A2925', background: '#fff', color: '#2A2925', fontSize: 11.5, cursor: 'pointer' }}
                    >
                      복제해서 쓰기
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
