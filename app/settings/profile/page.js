'use client'

// app/settings/profile/page.js
// 내 프로필 — 사진·한 줄 소개를 올리면 자가진단 공개 링크(/apply/내아이디)에 반영돼서, 고객이
// 카톡 "문의하기"로 들어왔을 때 "머니콕"이라는 낯선 이름 대신 담당자 얼굴·이름을 먼저 보게 됨.

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/session'
import AppHeader from '../../components/AppHeader'

const btn = { padding: '11px 18px', borderRadius: 8, border: 'none', background: '#2A2925', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }

export default function ProfileSettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [file, setFile] = useState(null)
  const [intro, setIntro] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    const s = getSession()
    if (!s) { router.push('/'); return }
    setUser(s)
    fetch(`/api/consultant/profile`, { headers: { 'x-consultant-id': s.username } })
      .then((r) => r.json())
      .then((d) => { setProfile(d.profile); setIntro(d.profile?.profile_intro || '') })
  }, [])

  function pickFile(f) {
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  async function save() {
    setSaving(true); setError(null); setSaved(false)
    try {
      const formData = new FormData()
      if (file) formData.append('photo', file)
      formData.append('intro', intro)
      const res = await fetch('/api/consultant/profile', {
        method: 'POST', headers: { 'x-consultant-id': user.username }, body: formData,
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || '저장 실패')
      setProfile(d.profile)
      setSaved(true)
      setFile(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null

  const photoSrc = preview || profile?.profile_photo_url

  return (
    <div style={{ minHeight: '100vh', background: '#F7F6F2' }}>
      <AppHeader user={user} />
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '28px 20px 60px' }}>
        <h2 style={{ color: '#1a1a2e', margin: '0 0 4px' }}>내 프로필</h2>
        <p style={{ fontSize: 13, color: '#8A8A85', margin: '0 0 20px', lineHeight: 1.6 }}>
          사진·소개를 올리면 내 자가진단 링크(/apply/{user.username})에서 고객이 "머니콕" 대신 제 얼굴·이름을 먼저 보게 됩니다.
        </p>

        <div style={{ background: '#fff', borderRadius: 14, padding: 22, boxShadow: '0 2px 12px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: 100, height: 100, borderRadius: '50%', cursor: 'pointer', overflow: 'hidden',
              background: photoSrc ? `url(${photoSrc}) center/cover` : '#EFEEE9',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid #E0DFDA', flexShrink: 0,
            }}
          >
            {!photoSrc && <span style={{ fontSize: 28, color: '#B0AEA5' }}>{user.name?.slice(0, 1) || '?'}</span>}
          </div>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={(e) => e.target.files[0] && pickFile(e.target.files[0])} />
          <button onClick={() => fileInputRef.current?.click()} style={{ fontSize: 12.5, color: '#3A5A78', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>사진 {photoSrc ? '변경' : '올리기'}</button>

          <p style={{ fontSize: 17, fontWeight: 700, color: '#2A2925', margin: 0 }}>{user.name}</p>

          <div style={{ width: '100%' }}>
            <span style={{ fontSize: 12.5, color: '#5F5E5A', display: 'block', marginBottom: 6, fontWeight: 600 }}>한 줄 소개 (선택)</span>
            <input
              value={intro} onChange={(e) => setIntro(e.target.value)} placeholder="예: 정책자금 컨설팅 5년, 소상공인 전문"
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #D3D1C7', fontSize: 13.5, boxSizing: 'border-box' }}
            />
          </div>

          {error && <p style={{ color: '#C0392B', fontSize: 13, margin: 0 }}>{error}</p>}
          {saved && <p style={{ color: '#085041', fontSize: 13, margin: 0 }}>✓ 저장했습니다.</p>}
          <button onClick={save} disabled={saving} style={{ ...btn, width: '100%' }}>{saving ? '저장 중…' : '저장'}</button>
        </div>
      </div>
    </div>
  )
}
