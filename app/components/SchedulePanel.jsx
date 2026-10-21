'use client'
import { useState, useEffect } from 'react'

// 관리자 전용: 소진공·중진공 등 접수일정 입력 → 모든 컨설턴트의 정책자금 캘린더에 표시
export default function SchedulePanel({ user }) {
  const headers = { 'x-consultant-id': user.username, 'x-consultant-role': user.role, 'Content-Type': 'application/json' }
  const [rows, setRows] = useState([])
  const [f, setF] = useState({ org: '소진공', title: '', startDate: '', endDate: '', url: '', note: '' })
  const [msg, setMsg] = useState('')
  const load = async () => {
    const r = await fetch('/api/schedules', { headers })
    if (r.ok) setRows((await r.json()).schedules || [])
  }
  useEffect(() => { load() }, [])
  const add = async () => {
    setMsg('')
    const r = await fetch('/api/schedules', { method: 'POST', headers, body: JSON.stringify(f) })
    const d = await r.json()
    if (!r.ok) { setMsg(d.error || '저장 실패'); return }
    setF({ ...f, title: '', startDate: '', endDate: '', url: '', note: '' })
    setMsg('추가했어요. 모든 컨설턴트 캘린더에 표시됩니다.')
    load()
  }
  const del = async (id) => {
    if (!confirm('이 일정을 삭제할까요?')) return
    await fetch(`/api/schedules?id=${id}`, { method: 'DELETE', headers })
    load()
  }
  const inp = { padding: '7px 9px', border: '1px solid #ccc', borderRadius: 6, fontSize: 13 }
  return (
    <div style={{ background: '#fff', border: '1px solid #E4E0D6', borderRadius: 10, padding: 16, margin: '0 0 20px' }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>🗓️ 접수일정 직접 입력 (소진공·중진공 등)</div>
      <p style={{ fontSize: 12.5, color: '#777', margin: '0 0 12px', lineHeight: 1.6 }}>공고가 미리 안 뜨는 자금의 접수일정을 입력하면 전체 컨설턴트의 <b>정책자금 캘린더</b>에 표시돼요. 마감일(접수 종료일) 날짜에 표시되고, 마감일을 비우면 "상시/예산소진 시" 목록에 들어갑니다.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select style={inp} value={f.org} onChange={(e) => setF({ ...f, org: e.target.value })}>
          {['소진공', '중진공', '신보', '기보', '신용보증재단', '기타'].map((o) => <option key={o}>{o}</option>)}
        </select>
        <input style={{ ...inp, width: 220 }} placeholder="자금명 (예: 신용취약소상공인자금 1차)" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <label style={{ fontSize: 12.5 }}>접수 시작 <input type="date" style={inp} value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></label>
        <label style={{ fontSize: 12.5 }}>접수 마감 <input type="date" style={inp} value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></label>
        <input style={{ ...inp, width: 200 }} placeholder="링크(선택, https://…)" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />
        <input style={{ ...inp, width: 200 }} placeholder="메모(선택)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        <button onClick={add} style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: '#0f3460', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>추가</button>
      </div>
      {msg && <p style={{ fontSize: 12.5, color: '#2A7D46', margin: '8px 0 0' }}>{msg}</p>}
      {rows.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {rows.map((r) => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12.5, padding: '6px 0', borderTop: '1px solid #F0EEE8' }}>
              <span><b>[{r.org}]</b> {r.title} · {r.start_date || '?'} ~ {r.end_date || '상시'}{r.note ? ` · ${r.note}` : ''}</span>
              <button onClick={() => del(r.id)} style={{ border: '1px solid #E0B4B0', color: '#B3261E', background: '#fff', borderRadius: 5, padding: '2px 8px', cursor: 'pointer', fontSize: 11.5 }}>삭제</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
