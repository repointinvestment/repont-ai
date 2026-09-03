'use client'

// app/contracts/page.js
// 내 계약 관리 — 컨설턴트가 "자기 고객"과 맺는 정책자금 컨설팅 계약을 만들고, 고객이 이 화면(태블릿/노트북)에서
// 대면으로 직접 서명하고, 입금 확인까지 여기서 처리. 대표(admin)와의 계약이 아니라 컨설턴트 개인 사업임 —
// 그래서 여기 나오는 계약은 전부 이 컨설턴트가 만든 것만(자기 고객 것만) 보임.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/session'
import AppHeader from '../components/AppHeader'
import SignaturePad from '../components/SignaturePad'

const STATUS_STYLE = {
  '서명대기': { bg: '#FAEEDA', fg: '#633806' },
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

export default function MyContractsPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [contracts, setContracts] = useState([])
  const [customers, setCustomers] = useState([])
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ customerId: '', feeAmount: '1000000', feeStructure: 'flat', successFeePct: '5', consultantName: '' })
  const [signing, setSigning] = useState(null)
  const [sigData, setSigData] = useState(null)
  const [signedName, setSignedName] = useState('')
  const [viewingSig, setViewingSig] = useState(null)
  const [viewingContent, setViewingContent] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const s = getSession()
    if (!s) { router.push('/'); return }
    setUser(s)
    load(s)
    fetch('/api/customers', { headers: { 'x-consultant-id': s.username, 'x-consultant-role': s.role } })
      .then((r) => r.json()).then((d) => setCustomers(d.customers || []))
  }, [])

  function headers(s = user) {
    return { 'Content-Type': 'application/json', 'x-consultant-id': s.username, 'x-consultant-role': s.role }
  }

  async function load(s = user) {
    const r = await fetch('/api/contracts', { headers: headers(s) })
    const d = await r.json()
    setContracts(d.contracts || [])
  }

  function openCreate() {
    setForm({ customerId: '', feeAmount: '1000000', feeStructure: 'flat', successFeePct: '5', consultantName: user.name || '' })
    setError(null)
    setCreating(true)
  }

  async function submitCreate() {
    if (!form.customerId) { setError('고객을 선택해주세요.'); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/customers/${form.customerId}/contracts`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({
          feeAmount: Number(form.feeAmount) || 1000000, feeStructure: form.feeStructure,
          successFeePct: form.feeStructure === 'flat_plus_success' ? Number(form.successFeePct) || 5 : null,
          consultantName: form.consultantName,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || '생성 실패')
      setCreating(false)
      load()
    } catch (err) {
      setError(err.message)
    } finally { setSaving(false) }
  }

  function openSign(c) {
    setSigning(c); setSigData(null); setSignedName(c.owner_name || ''); setError(null)
  }

  async function submitSign() {
    if (!sigData) { setError('서명을 입력해주세요.'); return }
    if (!signedName.trim()) { setError('이름을 입력해주세요.'); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/contracts/${signing.id}/sign`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ signatureData: sigData, signedName }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || '서명 실패')
      setSigning(null)
      load()
    } catch (err) {
      setError(err.message)
    } finally { setSaving(false) }
  }

  async function confirmPayment(c) {
    if (!confirm(`${c.owner_name || '고객'}님 계약 입금을 확인 처리할까요? (오늘부터 1년 활성화)`)) return
    await fetch(`/api/contracts/${c.id}/confirm-payment`, { method: 'POST', headers: headers() })
    load()
  }

  if (!user) return null

  return (
    <div style={{ minHeight: '100vh', background: '#F7F6F2' }}>
      <AppHeader user={user} />
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '28px 20px 60px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ color: '#1a1a2e', margin: 0 }}>내 계약 관리</h2>
            <p style={{ fontSize: 13, color: '#8A8A85', margin: '6px 0 0' }}>내 고객과 맺는 정책자금 컨설팅 계약입니다. 고객이 이 화면에서 대면으로 직접 서명합니다.</p>
          </div>
          <button style={btn} onClick={openCreate}>+ 계약 생성</button>
        </div>

        {contracts.length === 0 && <p style={{ fontSize: 13, color: '#B0AEA5' }}>아직 만든 계약이 없습니다.</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {contracts.map((c) => {
            const st = STATUS_STYLE[c.status] || STATUS_STYLE['서명대기']
            return (
              <div key={c.id} style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 14.5, color: '#2A2925', cursor: 'pointer' }} onClick={() => c.customer_id && router.push(`/customers/${c.customer_id}`)}>
                        {c.owner_name || '고객 미지정'} {c.business_name ? `· ${c.business_name}` : ''}
                      </strong>
                      <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 999, background: st.bg, color: st.fg, fontWeight: 700 }}>{c.status}</span>
                    </div>
                    <p style={{ fontSize: 12.5, color: '#5F5E5A', margin: '6px 0 0' }}>
                      {c.fee_amount?.toLocaleString()}원/년{c.fee_structure === 'flat_plus_success' ? ` + 성공보수 ${c.success_fee_pct}%` : ''}
                    </p>
                    {c.signed_at && <p style={{ fontSize: 12, color: '#8A8A85', margin: '3px 0 0' }}>서명: {c.signed_name} · {new Date(c.signed_at).toLocaleString('ko-KR')}</p>}
                    {c.start_date && <p style={{ fontSize: 12, color: '#8A8A85', margin: '3px 0 0' }}>계약기간: {c.start_date} ~ {c.end_date}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button style={{ ...btnGhost, padding: '6px 11px', fontSize: 11.5 }} onClick={() => setViewingContent(c)}>계약서 보기</button>
                    {c.signature_data && <button style={{ ...btnGhost, padding: '6px 11px', fontSize: 11.5 }} onClick={() => setViewingSig(c)}>서명 보기</button>}
                    {c.status === '서명대기' && <button style={{ ...btn, padding: '6px 11px', fontSize: 11.5 }} onClick={() => openSign(c)}>고객 서명 받기</button>}
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
              <span style={{ fontSize: 12, color: '#5F5E5A', display: 'block', marginBottom: 5, fontWeight: 600 }}>고객</span>
              <select style={input} value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
                <option value="">선택</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.owner_name} {c.business_name ? `(${c.business_name})` : ''}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: '#5F5E5A', display: 'block', marginBottom: 5, fontWeight: 600 }}>계약서에 표시할 내 이름</span>
              <input style={input} value={form.consultantName} onChange={(e) => setForm({ ...form, consultantName: e.target.value })} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: '#5F5E5A', display: 'block', marginBottom: 5, fontWeight: 600 }}>연 컨설팅 비용 (원)</span>
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

      {signing && (
        <div onClick={() => setSigning(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', overflowY: 'auto', zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 480 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#2A2925', margin: '0 0 4px' }}>고객 서명</p>
            <p style={{ fontSize: 12, color: '#8A8A85', margin: '0 0 12px' }}>고객님께 이 화면을 보여드리고 직접 서명받아 주세요.</p>
            <div style={{ background: '#F7F5F0', borderRadius: 8, padding: 14, maxHeight: 220, overflowY: 'auto', fontSize: 12.5, color: '#2A2925', whiteSpace: 'pre-wrap', lineHeight: 1.7, marginBottom: 16 }}>
              {signing.content}
            </div>
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: '#5F5E5A', display: 'block', marginBottom: 5, fontWeight: 600 }}>서명자(고객) 이름</span>
              <input value={signedName} onChange={(e) => setSignedName(e.target.value)} style={{ ...input }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <span style={{ fontSize: 12, color: '#5F5E5A', display: 'block', marginBottom: 5, fontWeight: 600 }}>전자서명</span>
              <SignaturePad onChange={setSigData} />
            </div>
            {error && <p style={{ color: '#C0392B', fontSize: 12.5, margin: '0 0 10px' }}>{error}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button style={btnGhost} onClick={() => setSigning(null)}>취소</button>
              <button style={btn} disabled={saving} onClick={submitSign}>{saving ? '제출 중…' : '서명 제출'}</button>
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

      {viewingContent && (
        <div onClick={() => setViewingContent(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 22, maxWidth: 480, maxHeight: '80vh', overflowY: 'auto' }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#2A2925', margin: '0 0 12px' }}>계약서 내용</p>
            <p style={{ fontSize: 12.5, color: '#2A2925', whiteSpace: 'pre-wrap', lineHeight: 1.7, margin: 0 }}>{viewingContent.content}</p>
          </div>
        </div>
      )}
    </div>
  )
}
