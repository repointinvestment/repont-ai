'use client';

// app/contracts/page.js
// 내 계약서 — 컨설턴트/수강생이 본인에게 발송된 연간계약을 보고 전자서명하는 화면.
// 관리자는 여기서도 자기 계약을 보되, 계약 생성·입금확인은 /admin/contracts에서.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/session';
import AppHeader from '../components/AppHeader';
import SignaturePad from '../components/SignaturePad';

const STATUS_STYLE = {
  '발송': { bg: '#FAEEDA', fg: '#633806' },
  '서명완료': { bg: '#E6F1FB', fg: '#0C447C' },
  '입금확인': { bg: '#E1F5EE', fg: '#085041' },
  '만료': { bg: '#EFEEE9', fg: '#8A8A85' },
  '해지': { bg: '#FAECE7', fg: '#712B13' },
}

export default function MyContractsPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [contracts, setContracts] = useState([])
  const [signing, setSigning] = useState(null) // contract being signed
  const [sigData, setSigData] = useState(null)
  const [signedName, setSignedName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const s = getSession()
    if (!s) { router.push('/'); return }
    setUser(s)
    load(s)
  }, [])

  async function load(s) {
    const r = await fetch('/api/contracts', { headers: { 'x-consultant-id': s.username, 'x-consultant-role': s.role } })
    const d = await r.json()
    setContracts(d.contracts || [])
  }

  function openSign(c) {
    setSigning(c); setSigData(null); setSignedName(user.name || ''); setError(null)
  }

  async function submitSign() {
    if (!sigData) { setError('서명을 입력해주세요.'); return }
    if (!signedName.trim()) { setError('이름을 입력해주세요.'); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/contracts/${signing.id}/sign`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureData: sigData, signedName }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || '서명 실패')
      setSigning(null)
      load(user)
    } catch (err) {
      setError(err.message)
    } finally { setSaving(false) }
  }

  if (!user) return null

  const daysLeft = (end) => end ? Math.ceil((new Date(end) - new Date()) / (1000 * 60 * 60 * 24)) : null

  return (
    <div style={{ minHeight: '100vh', background: '#F7F6F2' }}>
      <AppHeader user={user} />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 20px 60px' }}>
        <h2 style={{ color: '#1a1a2e', margin: '0 0 4px' }}>내 계약서</h2>
        <p style={{ fontSize: 13, color: '#8A8A85', margin: '0 0 20px' }}>자금비서 이용 계약 현황입니다. "발송" 상태인 계약은 서명이 필요합니다.</p>

        {contracts.length === 0 && <p style={{ fontSize: 13, color: '#B0AEA5' }}>계약 건이 없습니다.</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {contracts.map((c) => {
            const st = STATUS_STYLE[c.status] || STATUS_STYLE['발송']
            const dl = c.status === '입금확인' ? daysLeft(c.end_date) : null
            return (
              <div key={c.id} style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <strong style={{ fontSize: 14.5, color: '#2A2925' }}>자금비서 이용계약</strong>
                      <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 999, background: st.bg, color: st.fg, fontWeight: 700 }}>{c.status}</span>
                    </div>
                    <p style={{ fontSize: 12.5, color: '#5F5E5A', margin: '6px 0 0' }}>
                      {c.fee_amount?.toLocaleString()}원/년{c.fee_structure === 'flat_plus_success' ? ` + 성공보수 ${c.success_fee_pct}%` : ''}
                    </p>
                    {c.start_date && <p style={{ fontSize: 12, color: '#8A8A85', margin: '3px 0 0' }}>계약기간: {c.start_date} ~ {c.end_date}{dl != null && (dl <= 30 ? ` (${dl}일 남음)` : '')}</p>}
                  </div>
                  {c.status === '발송' && (
                    <button onClick={() => openSign(c)} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#2A2925', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>서명하기</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {signing && (
        <div onClick={() => setSigning(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', overflowY: 'auto', zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 480 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#2A2925', margin: '0 0 12px' }}>계약서 서명</p>
            <div style={{ background: '#F7F5F0', borderRadius: 8, padding: 14, maxHeight: 260, overflowY: 'auto', fontSize: 12.5, color: '#2A2925', whiteSpace: 'pre-wrap', lineHeight: 1.7, marginBottom: 16 }}>
              {signing.content}
            </div>
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: '#5F5E5A', display: 'block', marginBottom: 5, fontWeight: 600 }}>서명자 이름</span>
              <input value={signedName} onChange={(e) => setSignedName(e.target.value)} style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid #D3D1C7', fontSize: 13.5, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <span style={{ fontSize: 12, color: '#5F5E5A', display: 'block', marginBottom: 5, fontWeight: 600 }}>전자서명</span>
              <SignaturePad onChange={setSigData} />
            </div>
            {error && <p style={{ color: '#C0392B', fontSize: 12.5, margin: '0 0 10px' }}>{error}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setSigning(null)} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid #2A2925', background: '#fff', color: '#2A2925', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>취소</button>
              <button disabled={saving} onClick={submitSign} style={{ padding: '9px 14px', borderRadius: 8, border: 'none', background: '#2A2925', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{saving ? '제출 중…' : '서명 제출'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
