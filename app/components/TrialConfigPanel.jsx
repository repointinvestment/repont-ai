'use client'
import { useState, useEffect } from 'react'

// 웨비나 체험 이용권 설정 패널(관리자 전용): 입장코드·이용기간·최대인원·신청 열기/닫기
export default function TrialConfigPanel({ user }) {
  const headers = { 'x-consultant-id': user.username, 'x-consultant-role': user.role, 'Content-Type': 'application/json' }
  const [cfg, setCfg] = useState({ code: '', maxSignups: 300, days: 7, active: false })
  const [stats, setStats] = useState(null)
  const [msg, setMsg] = useState('')

  const load = async () => {
    const res = await fetch('/api/admin/trial-config', { headers })
    if (!res.ok) return
    const d = await res.json()
    if (d.config) setCfg({ code: d.config.code || '', maxSignups: d.config.max_signups, days: d.config.days, active: d.config.active })
    setStats(d.stats)
  }
  useEffect(() => { load() }, [])

  const save = async () => {
    setMsg('')
    const res = await fetch('/api/admin/trial-config', { method: 'POST', headers, body: JSON.stringify(cfg) })
    const d = await res.json()
    setMsg(res.ok ? '저장했어요.' : d.error || '저장 실패')
    load()
  }
  const cleanup = async () => {
    if (!confirm('만료 후 1일 이상 지난 체험 계정과 그 계정의 고객 데이터를 삭제할까요?')) return
    const res = await fetch('/api/admin/trial-config', { method: 'POST', headers, body: JSON.stringify({ action: 'cleanup' }) })
    const d = await res.json()
    setMsg(res.ok ? `${d.deleted}개 계정을 정리했어요.` : d.error || '실패')
    load()
  }

  const input = { padding: '8px 10px', border: '1px solid #ccc', borderRadius: 6, fontSize: 13, width: 110 }
  return (
    <div style={{ background: '#fff', border: '1px solid #E4E0D6', borderRadius: 10, padding: 16, margin: '0 0 20px' }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>🎁 웨비나 체험 이용권</div>
      <p style={{ fontSize: 12.5, color: '#777', margin: '0 0 12px', lineHeight: 1.6 }}>
        시청자에게 <b>/trial</b> 주소와 입장코드를 알려주면, 각자 가입해서 정해진 기간 동안 쓸 수 있어요. 기간이 지나면 로그인이 막힙니다.
        {stats && <> · 현재 가입 {stats.total}명 (이용 중 {stats.active}명)</>}
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ fontSize: 13 }}>입장코드 <input style={{ ...input, width: 150 }} value={cfg.code} onChange={(e) => setCfg({ ...cfg, code: e.target.value })} /></label>
        <label style={{ fontSize: 13 }}>이용기간(일) <input style={input} type="number" value={cfg.days} onChange={(e) => setCfg({ ...cfg, days: e.target.value })} /></label>
        <label style={{ fontSize: 13 }}>최대 인원 <input style={input} type="number" value={cfg.maxSignups} onChange={(e) => setCfg({ ...cfg, maxSignups: e.target.value })} /></label>
        <label style={{ fontSize: 13 }}><input type="checkbox" checked={cfg.active} onChange={(e) => setCfg({ ...cfg, active: e.target.checked })} /> 신청 받는 중</label>
        <button onClick={save} style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: '#0f3460', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>저장</button>
        <button onClick={cleanup} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #999', background: '#fff', cursor: 'pointer' }}>만료 계정 정리</button>
      </div>
      {msg && <p style={{ fontSize: 12.5, color: '#2A7D46', margin: '10px 0 0' }}>{msg}</p>}
    </div>
  )
}
