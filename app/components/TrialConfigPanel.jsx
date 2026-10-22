'use client'
import { useState, useEffect } from 'react'

// 웨비나 체험 이용권 설정 패널(관리자 전용): 입장코드·이용기간·최대인원·신청 열기/닫기
export default function TrialConfigPanel({ user }) {
  const headers = { 'x-consultant-id': user.username, 'x-consultant-role': user.role, 'Content-Type': 'application/json' }
  const [cfg, setCfg] = useState({ code: '', maxSignups: 300, days: 7, active: false })
  const [stats, setStats] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [inquiries, setInquiries] = useState([])
  const [msg, setMsg] = useState('')
  const [copied, setCopied] = useState('')
  const trialUrl = typeof window !== 'undefined' ? `${window.location.origin}/trial` : ''
  const copy = async (label, text) => {
    try { await navigator.clipboard.writeText(text); setCopied(label); setTimeout(() => setCopied(''), 2000) } catch { setMsg('복사에 실패했어요. 직접 선택해서 복사해주세요.') }
  }

  const load = async () => {
    const res = await fetch('/api/admin/trial-config', { headers })
    if (!res.ok) return
    const d = await res.json()
    if (d.config) setCfg({ code: d.config.code || '', maxSignups: d.config.max_signups, days: d.config.days, active: d.config.active })
    setStats(d.stats)
    setAccounts(d.accounts || [])
    setInquiries(d.inquiries || [])
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

  const act = async (body, confirmMsg) => {
    if (confirmMsg && !confirm(confirmMsg)) return
    await fetch('/api/admin/trial-config', { method: 'POST', headers, body: JSON.stringify(body) })
    load()
  }
  const remain = (exp) => {
    const ms = new Date(exp).getTime() - Date.now()
    if (ms <= 0) return { text: '만료', color: '#B3261E' }
    const d = Math.floor(ms / 86400000)
    const h = Math.floor((ms % 86400000) / 3600000)
    return { text: d > 0 ? `${d}일 ${h}시간 남음` : `${h}시간 남음`, color: d <= 1 ? '#B26A00' : '#2A7D46' }
  }
  const fmt = (t) => new Date(t).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
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
      <div style={{ marginTop: 14, padding: 12, background: '#F4F7FB', borderRadius: 8, fontSize: 13 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>📋 시청자에게 공유할 내용</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
          <span>가입 주소</span>
          <input readOnly value={trialUrl} onFocus={(e) => e.target.select()} style={{ ...input, width: 280 }} />
          <button onClick={() => copy('url', trialUrl)} style={{ padding: '7px 12px', borderRadius: 6, border: 'none', background: '#0f3460', color: '#fff', cursor: 'pointer' }}>{copied === 'url' ? '복사됨 ✓' : '주소 복사'}</button>
        </div>
        <button disabled={!cfg.code} onClick={() => copy('msg', `🎁 자금비서 ${cfg.days}일 무료 이용권\n가입 주소: ${trialUrl}\n입장코드: ${cfg.code}\n(가입 후 ${cfg.days}일간 사용 가능합니다)`)}
          style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid #0f3460', background: '#fff', color: '#0f3460', cursor: cfg.code ? 'pointer' : 'not-allowed' }}>
          {copied === 'msg' ? '복사됨 ✓' : '안내문 통째로 복사 (주소+입장코드)'}
        </button>
        {!cfg.code && <span style={{ marginLeft: 8, color: '#999', fontSize: 12 }}>입장코드를 먼저 입력·저장하세요</span>}
      </div>
      {inquiries.length > 0 && (
        <div style={{ marginTop: 14, padding: 12, background: '#FFF8E6', border: '1px solid #F0DDA8', borderRadius: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 8 }}>📞 연장·강의 문의 ({inquiries.length}건)</div>
          {inquiries.map((q) => (
            <div key={q.id} style={{ fontSize: 12.5, padding: '6px 0', borderTop: '1px solid #F3E7C2' }}>
              <b>{q.name || q.username}</b> · <a href={`tel:${q.phone}`} style={{ color: '#0f3460' }}>{q.phone}</a> · <span style={{ color: '#888' }}>{fmt(q.created_at)}</span>
              {q.message && <div style={{ color: '#555', marginTop: 2 }}>{q.message}</div>}
              {q.sms_status && <div style={{ color: q.sms_status.startsWith('발송됨') ? '#2A7D46' : '#C0392B', marginTop: 2, fontSize: 11.5 }}>📲 알림 문자: {q.sms_status}</div>}
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 8 }}>👥 체험 가입자 ({accounts.length}명)</div>
        {accounts.length === 0 ? <p style={{ fontSize: 12.5, color: '#999', margin: 0 }}>아직 가입자가 없어요.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#777', borderBottom: '1px solid #E4E0D6' }}>
                  <th style={{ padding: '6px 8px' }}>이름</th><th style={{ padding: '6px 8px' }}>아이디</th><th style={{ padding: '6px 8px' }}>가입일시</th>
                  <th style={{ padding: '6px 8px' }}>남은 기한</th><th style={{ padding: '6px 8px' }}>고객</th><th style={{ padding: '6px 8px' }}>AI 사용</th><th style={{ padding: '6px 8px' }}></th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => {
                  const r = remain(a.expires_at)
                  return (
                    <tr key={a.username} style={{ borderBottom: '1px solid #F0EEE8' }}>
                      <td style={{ padding: '6px 8px' }}>{a.name}</td>
                      <td style={{ padding: '6px 8px', color: '#666' }}>{a.username}</td>
                      <td style={{ padding: '6px 8px', color: '#666' }}>{fmt(a.created_at)}</td>
                      <td style={{ padding: '6px 8px', color: r.color, fontWeight: 600 }}>{r.text}</td>
                      <td style={{ padding: '6px 8px' }}>{a.customers}명</td>
                      <td style={{ padding: '6px 8px' }}>{a.ai_uses}회</td>
                      <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                        <button onClick={() => act({ action: 'extend', username: a.username, days: 7 }, `${a.name}님 기간을 7일 연장할까요?`)} style={{ padding: '3px 8px', marginRight: 4, border: '1px solid #aaa', borderRadius: 5, background: '#fff', cursor: 'pointer', fontSize: 11.5 }}>+7일</button>
                        <button onClick={() => act({ action: 'delete', username: a.username }, `${a.name}(${a.username}) 계정과 데이터를 삭제할까요?`)} style={{ padding: '3px 8px', border: '1px solid #E0B4B0', color: '#B3261E', borderRadius: 5, background: '#fff', cursor: 'pointer', fontSize: 11.5 }}>삭제</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {msg && <p style={{ fontSize: 12.5, color: '#2A7D46', margin: '10px 0 0' }}>{msg}</p>}
    </div>
  )
}
