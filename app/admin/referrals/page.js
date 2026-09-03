'use client'

// app/admin/referrals/page.js
// 대표 의뢰함 — 컨설턴트가 "문수환 대표에게 의뢰" 버튼으로 넘긴 법인전환/절세/상속/기타 케이스 목록.
// 관리자(대표)만 접근. 상태를 대기→처리중→완료로 바꿀 수 있음.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/session'
import AppHeader from '../../components/AppHeader'

const STATUS_STYLE = {
  '대기': { bg: '#FAECE7', fg: '#712B13' },
  '처리중': { bg: '#FAEEDA', fg: '#633806' },
  '완료': { bg: '#E1F5EE', fg: '#085041' },
}

export default function ReferralsInboxPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [referrals, setReferrals] = useState([])
  const [filter, setFilter] = useState('')
  const [drafts, setDrafts] = useState({}) // { [id]: 답변 초안 텍스트 }
  const [saving, setSaving] = useState(null)

  useEffect(() => {
    const s = getSession()
    if (!s) { router.push('/'); return }
    if (s.role !== 'admin') { router.push('/menu'); return }
    setUser(s)
    load(s)
  }, [])

  async function load(s = user) {
    const r = await fetch('/api/referrals', { headers: { 'x-consultant-id': s.username, 'x-consultant-role': s.role } })
    const d = await r.json()
    setReferrals(d.referrals || [])
  }

  async function setStatus(id, status) {
    await fetch(`/api/referrals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-consultant-id': user.username, 'x-consultant-role': user.role },
      body: JSON.stringify({ status }),
    })
    load()
  }

  async function saveReply(r) {
    const adminNote = drafts[r.id]
    if (adminNote === undefined) return
    setSaving(r.id)
    try {
      await fetch(`/api/referrals/${r.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-consultant-id': user.username, 'x-consultant-role': user.role },
        body: JSON.stringify({ adminNote, status: r.status === '대기' ? '처리중' : r.status }),
      })
      setDrafts((d) => { const n = { ...d }; delete n[r.id]; return n })
      load()
    } finally {
      setSaving(null)
    }
  }

  if (!user) return null

  const filtered = filter ? referrals.filter((r) => r.status === filter) : referrals
  const btn = { padding: '7px 12px', borderRadius: 7, border: '1px solid #2A2925', background: '#fff', color: '#2A2925', fontSize: 12, fontWeight: 600, cursor: 'pointer' }

  return (
    <div style={{ minHeight: '100vh', background: '#F7F6F2' }}>
      <AppHeader user={user} />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 20px 60px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ color: '#1a1a2e', margin: 0 }}>대표 의뢰함</h2>
            <p style={{ fontSize: 13, color: '#8A8A85', margin: '6px 0 0' }}>컨설턴트가 법인전환·절세·상속 등으로 이관한 케이스입니다.</p>
          </div>
          <button style={{ ...btn }} onClick={() => router.push('/menu')}>메뉴로</button>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {['', '대기', '처리중', '완료'].map((s) => (
            <button key={s || 'all'} onClick={() => setFilter(s)}
              style={{ ...btn, background: filter === s ? '#2A2925' : '#fff', color: filter === s ? '#fff' : '#2A2925' }}>
              {s || '전체'} {s ? `(${referrals.filter((r) => r.status === s).length})` : `(${referrals.length})`}
            </button>
          ))}
        </div>

        {filtered.length === 0 && <p style={{ fontSize: 13, color: '#B0AEA5' }}>의뢰 건이 없습니다.</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((r) => {
            const st = STATUS_STYLE[r.status] || STATUS_STYLE['대기']
            return (
              <div key={r.id} style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 14.5, color: '#2A2925', cursor: 'pointer' }} onClick={() => router.push(`/customers/${r.customer_id}`)}>
                        {r.owner_name || '이름 미입력'} {r.business_name ? `· ${r.business_name}` : ''}
                      </strong>
                      <span style={{ fontSize: 11.5, padding: '2px 9px', borderRadius: 999, background: '#E6F1FB', color: '#0C447C', fontWeight: 700 }}>{r.issue_type}</span>
                      <span style={{ fontSize: 11.5, padding: '2px 9px', borderRadius: 999, background: st.bg, color: st.fg, fontWeight: 700 }}>{r.status}</span>
                    </div>
                    {r.phone && <div style={{ fontSize: 12, color: '#8A8A85', marginTop: 4 }}>{r.phone}</div>}
                    {r.note && <div style={{ fontSize: 13, color: '#2A2925', marginTop: 8 }}>{r.note}</div>}
                    <div style={{ fontSize: 11, color: '#B0AEA5', marginTop: 6 }}>
                      {r.created_by ? `${r.created_by} · ` : ''}{new Date(r.created_at).toLocaleString('ko-KR')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {['대기', '처리중', '완료'].filter((s) => s !== r.status).map((s) => (
                      <button key={s} onClick={() => setStatus(r.id, s)} style={{ ...btn, padding: '5px 10px', fontSize: 11.5 }}>{s}로</button>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #EFEEE9' }}>
                  <p style={{ fontSize: 11.5, fontWeight: 700, color: '#5F5E5A', margin: '0 0 6px' }}>{r.created_by || '컨설턴트'}에게 답변</p>
                  <textarea
                    value={drafts[r.id] !== undefined ? drafts[r.id] : (r.admin_note || '')}
                    onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                    placeholder="답변을 입력하면 해당 컨설턴트의 '내 의뢰 이력' 화면에 표시됩니다."
                    style={{ width: '100%', minHeight: 60, padding: '9px 11px', borderRadius: 8, border: '1px solid #D3D1C7', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                    <button
                      onClick={() => saveReply(r)}
                      disabled={saving === r.id || drafts[r.id] === undefined}
                      style={{ ...btn, background: '#2A2925', color: '#fff', padding: '6px 12px', fontSize: 11.5, opacity: drafts[r.id] === undefined ? 0.5 : 1 }}>
                      {saving === r.id ? '저장 중…' : '답변 저장'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
