'use client'
import { useState } from 'react'

// 체험 계정 메인화면 안내 + 연장·강의 문의 접수 (연락처를 남기면 대표에게 전달됨)
export default function TrialInquiryBox({ user }) {
  const [open, setOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [state, setState] = useState('')
  const [busy, setBusy] = useState(false)
  const headers = { 'Content-Type': 'application/json', 'x-consultant-id': user.username, 'x-consultant-role': user.role }

  const submit = async () => {
    setBusy(true); setState('')
    try {
      const res = await fetch('/api/trial/inquiry', { method: 'POST', headers, body: JSON.stringify({ phone, message }) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || '접수 실패')
      setState('done')
    } catch (e) {
      setState(e.message)
    } finally { setBusy(false) }
  }

  return (
    <div style={{ maxWidth: 880, margin: '14px auto 0', padding: '14px 16px', background: '#FFF8E6', border: '1px solid #F0DDA8', borderRadius: 12, fontSize: 13.5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <strong>🎁 체험 이용권 사용 중이에요</strong>
          <div style={{ color: '#6B5B2A', fontSize: 12.5, marginTop: 2 }}>기간 연장이나 정식 이용·강의 안내가 필요하시면 문의를 남겨주세요.</div>
        </div>
        {!open && <button onClick={() => setOpen(true)} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#0B2440', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>연장·강의 문의하기</button>}
      </div>
      {open && state !== 'done' && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="연락받을 휴대폰번호 (010-0000-0000)" style={{ padding: '9px 11px', border: '1px solid #D3D1C7', borderRadius: 8 }} />
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="문의 내용 (선택) 예: 기간 연장하고 싶어요 / 강의 일정이 궁금해요" style={{ padding: '9px 11px', border: '1px solid #D3D1C7', borderRadius: 8, fontFamily: 'inherit' }} />
          {state && <span style={{ color: '#B3261E', fontSize: 12.5 }}>{state}</span>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={submit} disabled={busy} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#0B2440', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>{busy ? '접수 중…' : '문의 접수'}</button>
            <button onClick={() => setOpen(false)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #999', background: '#fff', cursor: 'pointer' }}>닫기</button>
          </div>
        </div>
      )}
      {state === 'done' && <div style={{ marginTop: 10, color: '#2A7D46', fontWeight: 600 }}>문의가 접수되었어요. 곧 연락드릴게요.</div>}
    </div>
  )
}
