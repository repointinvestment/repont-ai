'use client'

// app/materials/page.js
// 내 안내자료 목록 — 만든 자료들과 각각 문의 몇 건 왔는지 확인.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/session'
import AppHeader from '../components/AppHeader'

const btn = { padding: '9px 16px', borderRadius: 8, border: 'none', background: '#2A2925', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }
const btnGhost = { padding: '7px 12px', borderRadius: 7, border: '1px solid #D3D1C7', background: '#fff', color: '#5F5E5A', fontSize: 12, cursor: 'pointer' }

export default function MaterialsListPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState(null)

  useEffect(() => {
    const s = getSession()
    if (!s) { router.push('/'); return }
    setUser(s)
    fetch('/api/materials', { headers: { 'x-consultant-id': s.username, 'x-consultant-role': s.role } })
      .then((r) => r.json())
      .then((d) => setMaterials(d.materials || []))
      .finally(() => setLoading(false))
  }, [])

  function copyLink(id) {
    navigator.clipboard.writeText(`${window.location.origin}/m/${id}`)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  async function remove(m) {
    if (!confirm(`"${m.title}"을(를) 삭제할까요?`)) return
    await fetch(`/api/materials/${m.id}`, { method: 'DELETE', headers: { 'x-consultant-id': user.username, 'x-consultant-role': user.role } })
    setMaterials((prev) => prev.filter((x) => x.id !== m.id))
  }

  if (!user) return null

  return (
    <div style={{ minHeight: '100vh', background: '#F7F6F2' }}>
      <AppHeader user={user} />
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '28px 20px 60px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h2 style={{ color: '#1a1a2e', margin: 0 }}>내 안내자료</h2>
          <button style={btn} onClick={() => router.push('/materials/new')}>+ 새 자료</button>
        </div>
        <p style={{ fontSize: 13, color: '#8A8A85', margin: '6px 0 20px' }}>이미지·텍스트로 자료를 만들면 공유 링크가 생기고, 고객이 그 안에서 "문의하기"를 누르면 CRM에 자동 기록됩니다.</p>

        {loading ? (
          <p style={{ fontSize: 13, color: '#B0AEA5' }}>불러오는 중...</p>
        ) : materials.length === 0 ? (
          <p style={{ fontSize: 13, color: '#B0AEA5' }}>아직 만든 자료가 없습니다.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {materials.map((m) => (
              <div key={m.id} style={{ background: '#fff', borderRadius: 12, padding: '14px 18px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <strong style={{ fontSize: 14, color: '#2A2925' }}>{m.title}</strong>
                  <span style={{ fontSize: 11, color: '#B0AEA5', flexShrink: 0 }}>{new Date(m.updated_at).toLocaleDateString('ko-KR')}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  <button style={btnGhost} onClick={() => copyLink(m.id)}>{copiedId === m.id ? '복사됨 ✓' : '링크 복사'}</button>
                  <button style={btnGhost} onClick={() => window.open(`/m/${m.id}`, '_blank')}>미리보기</button>
                  <button style={btnGhost} onClick={() => router.push(`/materials/${m.id}/edit`)}>수정</button>
                  <button style={{ ...btnGhost, color: '#C0392B', borderColor: '#F0C9C2' }} onClick={() => remove(m)}>삭제</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
