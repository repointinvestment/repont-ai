'use client'

// app/admin/contracts/page.js
// 대표 전용 — 컨설턴트/수강생별 연간계약 생성, 서명 확인, 입금확인 처리.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/session'
import AppHeader from '../../components/AppHeader'

const STATUS_STYLE = {
  '발송': { bg: '#FAEEDA', fg: '#633806' },
  '서명완료': { bg: '#E6F1FB', fg: '#0C447C' },
  '입금확인': { bg: '#E1F5EE', fg: '#085041' },
  '만료': { bg: '#EFEEE9', fg: '#8A8A85' },
  '해지': { bg: '#FAECE7', fg: '#712B13' },
}
const FEE_STRUCTURES = [
  { key: 'flat', label: '정액만' },
  { key: 'flat_plus_success', label: '정액 + 성공보수 5%' },
]

const input = { width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid #D3D1C7', fontSize: 13.5, boxSizing: 'border-box', background: '#fff' }
const btn = { padding: '9px 14px', borderRadius: 8, border: 'none', background: '#2A2925', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const btnGhost = { ...btn, background: '#fff', color: '#2A2925', border: '1px solid #2A2925' }

export default function AdminContractsPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [contracts, setContracts] = useState([])
  const [accounts, setAccounts] = useState([])
  const [creating, setCreating] = useState(false)
  const [viewingSig, setViewingSig] = useState(null)
  const [form, setForm] = useState({ consultantUsername: '', feeAmount: '1000000', feeStructure: 'flat', successFeePct: '5' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const s = getSession()
    if (!s) { router.push('/'); return }
    if (s.role !== 'admin') { router.push('/menu'); return }
    setUser(s)
    load(s)
    fetch('/api/users').then((r) => r.json()).then((d) => setAccounts((d.users || []).filter((u) => u.role !== 'admin')))
  }, [])

  async function load(s) {
    const r = await fetch('/api/contracts', { headers: { 'x-consultant-id': s.username, 'x-consultant-role': s.role } })
    const d = await r.json()
    setContracts(d.contracts || [])
  }

  const headers = () => ({ 'Content-Type': 'application/json', 'x-consultant-id': user.username, 'x-consultant-role': user.role })

  async function submitCreate() {
    if (!form.consultantUsername) { setError('대상을 선택해주세요.'); return }
    setSaving(true); setError(null)
    try {
      const account = accounts.find((a) => a.username === form.consultantUsername)
      const res = await fetch('/api/contracts', {
        method: 'POST', headers: headers(),
        body: JSON.stringify({
          consultantUsername: form.consultantUsername, consultantName: account?.name,
          feeAmount: Number(form.feeAmount) || 1000000, feeStructure: form.feeStructure,
          successFeePct: form.feeStructure === 'flat_plus_success' ? Number(form.successFeePct) || 5 : null,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || '생성 실패')
      setCreating(false)
      load(user)
    } catch (err) {
      setError(err.message)
    } finally { setSaving(false) }
  }

  async function confirmPayment(c) {
    if (!confirm(`${c.consultant_name || c.consultant_username}님 계약 입금을 확인 처리할까요? (오늘부터 1년 활성화)`)) return
    await fetch(`/api/contracts/${c.id}/confirm-payment`, { method: 'POST', headers: headers() })
    load(user)
  }

  if (!user) return null

  return (
    <div style={{ minHeight: '100vh', background: '#F7F6F2' }}>
      <AppHeader user={user} />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 20px 60px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ color: '#1a1a2e', margin: 0 }}>연간계약 관리</h2>
            <p style={{ fontSize: 13, color: '#8A8A85', margin: '6px 0 0' }}>수강생·컨설턴트별 자금비서 이용계약을 생성하고 서명·입금을 확인합니다.</p>
          </div>
          <button style={btn} onClick={() => { setForm({ consultantUsername: '', feeAmount: '1000000', feeStructure: 'flat', successFeePct: '5' }); setCreating(true); setError(null) }}>+ 계약 생성</button>
        </div>

        {contracts.length === 0 && <p style={{ fontSize: 13, color: '#B0AEA5' }}>계약 건이 없습니다.</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {contracts.map((c) => {
            const st = STATUS_STYLE[c.status] || STATUS_STYLE['발송']
            return (
              <div key={c.id} style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 14.5, color: '#2A2925' }}>{c.consultant_name || c.consultant_username}</strong>
                      <span style={{ fontSize: 11, color: '#8A8A85' }}>@{c.consultant_username}</span>
                      <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 999, background: st.bg, color: st.fg, fontWeight: 700 }}>{c.status}</span>
                    </div>
                    <p style={{ fontSize: 12.5, color: '#5F5E5A', margin: '6px 0 0' }}>
                      {c.fee_amount?.toLocaleString()}원/년{c.fee_structure === 'flat_plus_success' ? ` + 성공보수 ${c.success_fee_pct}%` : ''}
                    </p>
                    {c.signed_at && <p style={{ fontSize: 12, color: '#8A8A85', margin: '3px 0 0' }}>서명: {c.signed_name} · {new Date(c.signed_at).toLocaleString('ko-KR')}</p>}
                    {c.start_date && <p style={{ fontSize: 12, color: '#8A8A85', margin: '3px 0 0' }}>계약기간: {c.start_date} ~ {c.end_date}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {c.signature_data && <button style={{ ...btnGhost, padding: '6px 11px', fontSize: 11.5 }} onClick={() => setViewingSig(c)}>서명 보기</button>}
                    {c.status === '서명완료' && <button style={{ ...btn, padding: '6px 11px', fontSize: 11.5 }} onClick={() => confirmPayment(c)}>입금확인</button>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {creating && (
        <div onClick={() => setCreating(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 22, width: 380 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#2A2925', margin: '0 0 14px' }}>계약 생성</p>
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: '#5F5E5A', display: 'block', marginBottom: 5, fontWeight: 600 }}>대상 계정</span>
              <select style={input} value={form.consultantUsername} onChange={(e) => setForm({ ...form, consultantUsername: e.target.value })}>
                <option value="">선택</option>
                {accounts.map((a) => <option key={a.username} value={a.username}>{a.name} (@{a.username})</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: '#5F5E5A', display: 'block', marginBottom: 5, fontWeight: 600 }}>연회비 (원)</span>
              <input style={input} value={form.feeAmount} onChange={(e) => setForm({ ...form, feeAmount: e.target.value })} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: '#5F5E5A', display: 'block', marginBottom: 5, fontWeight: 600 }}>수수료 구조</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {FEE_STRUCTURES.map((f) => (
                  <button key={f.key} type="button" onClick={() => setForm({ ...form, feeStructure: f.key })}
                    style={{ flex: 1, padding: '8px', borderRadius: 7, border: form.feeStructure === f.key ? '2px solid #2A2925' : '1px solid #D3D1C7', background: form.feeStructure === f.key ? '#F0EFEA' : '#fff', fontSize: 12, cursor: 'pointer' }}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            {error && <p style={{ color: '#C0392B', fontSize: 12.5, margin: '0 0 10px' }}>{error}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
              <button style={btnGhost} onClick={() => setCreating(false)}>취소</button>
              <button style={btn} disabled={saving} onClick={submitCreate}>{saving ? '생성 중…' : '생성'}</button>
            </div>
          </div>
        </div>
      )}

      {viewingSig && (
        <div onClick={() => setViewingSig(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 10px', color: '#2A2925' }}>{viewingSig.signed_name}님 서명</p>
            <img src={viewingSig.signature_data} alt="서명" style={{ border: '1px solid #E0DFDA', borderRadius: 8, maxWidth: 340 }} />
          </div>
        </div>
      )}
    </div>
  )
}
