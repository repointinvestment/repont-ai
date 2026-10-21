'use client'
import { useState } from 'react'

export default function TrialSignupPage() {
  const [form, setForm] = useState({ code: '', name: '', username: '', password: '' })
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)
  const [loading, setLoading] = useState(false)

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/trial/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.ok) setDone(data)
      else setError(data.error || '신청 중 오류가 발생했습니다.')
    } catch {
      setError('네트워크 오류가 발생했습니다. 다시 시도해주세요.')
    }
    setLoading(false)
  }

  const input = { width: '100%', padding: '12px 14px', border: '1.5px solid #e0e0e0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }
  const label = { display: 'block', fontSize: 13, fontWeight: 600, color: '#444', margin: '14px 0 6px' }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', padding: 16 }}>
      <div style={{ background: 'white', borderRadius: 16, padding: '36px 32px', width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 34 }}>🎁</div>
          <h1 style={{ margin: '6px 0 4px', fontSize: 20, color: '#1a1a2e' }}>자금비서 1주일 체험 이용권</h1>
          <p style={{ margin: 0, color: '#888', fontSize: 13 }}>웨비나 시청 선물 · AI 자금진단, 사업계획서 초안, 고객관리를 체험해보세요</p>
        </div>

        {done ? (
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#2A7D46' }}>가입이 완료되었어요!</p>
            <p style={{ fontSize: 14, color: '#444', lineHeight: 1.7 }}>
              {new Date(done.expiresAt).toLocaleDateString('ko-KR')}까지 ({done.days}일간) 이용할 수 있어요.<br />
              방금 입력한 아이디와 비밀번호로 로그인하세요.
            </p>
            <a href="/" style={{ display: 'inline-block', marginTop: 12, background: '#0f3460', color: 'white', padding: '12px 28px', borderRadius: 8, textDecoration: 'none', fontWeight: 700 }}>
              로그인하러 가기
            </a>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label style={label}>입장코드 (웨비나에서 안내드린 코드)</label>
            <input style={input} name="code" value={form.code} onChange={onChange} required />
            <label style={label}>이름</label>
            <input style={input} name="name" value={form.name} onChange={onChange} required />
            <label style={label}>사용할 아이디 (영문 소문자·숫자 4~20자)</label>
            <input style={input} name="username" value={form.username} onChange={onChange} autoCapitalize="none" required />
            <label style={label}>비밀번호 (8자 이상)</label>
            <input style={input} type="password" name="password" value={form.password} onChange={onChange} required />
            {error && <p style={{ color: '#e74c3c', fontSize: 13, margin: '14px 0 0', textAlign: 'center' }}>{error}</p>}
            <button type="submit" disabled={loading} style={{ width: '100%', marginTop: 20, padding: 14, background: '#0f3460', color: 'white', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              {loading ? '처리 중...' : '체험 이용권 받기'}
            </button>
            <p style={{ fontSize: 11, color: '#999', marginTop: 14, lineHeight: 1.6 }}>
              체험 기간이 끝나면 계정과 입력한 데이터는 삭제됩니다.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
