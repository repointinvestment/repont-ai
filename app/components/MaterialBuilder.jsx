'use client'

// app/components/MaterialBuilder.jsx
// 안내자료 만들기/수정 공용 에디터 — 이미지·텍스트 블록을 순서대로 쌓아서 고객용 페이지를 만듦.
// 노션 대신 자금비서 안에서 만들고, 자동으로 "문의하기" 버튼 붙은 공개 페이지가 생성됨.

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

const btn = { padding: '9px 16px', borderRadius: 8, border: 'none', background: '#2A2925', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }
const btnGhost = { ...btn, background: '#fff', color: '#2A2925', border: '1px solid #2A2925' }

export default function MaterialBuilder({ user, initial, materialId }) {
  const router = useRouter()
  const [title, setTitle] = useState(initial?.title || '')
  const [blocks, setBlocks] = useState(initial?.blocks || [])
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(null) // 저장 후 공유 링크
  const fileInputRef = useRef(null)

  function addText() {
    setBlocks((b) => [...b, { type: 'text', content: '' }])
  }
  function updateText(idx, content) {
    setBlocks((b) => b.map((blk, i) => (i === idx ? { ...blk, content } : blk)))
  }
  function removeBlock(idx) {
    setBlocks((b) => b.filter((_, i) => i !== idx))
  }

  async function addImage(file) {
    setUploading(true); setError(null)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await fetch('/api/materials/image-upload', { method: 'POST', headers: { 'x-consultant-id': user.username }, body: formData })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || '업로드 실패')
      setBlocks((b) => [...b, { type: 'image', url: d.url }])
    } catch (e) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }

  async function save() {
    if (!title.trim()) { setError('제목을 입력해주세요.'); return }
    setSaving(true); setError(null)
    try {
      const headers = { 'Content-Type': 'application/json', 'x-consultant-id': user.username, 'x-consultant-role': user.role }
      const res = materialId
        ? await fetch(`/api/materials/${materialId}`, { method: 'PATCH', headers, body: JSON.stringify({ title, blocks }) })
        : await fetch('/api/materials', { method: 'POST', headers, body: JSON.stringify({ title, blocks }) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || '저장 실패')
      const id = d.material.id
      setSaved(`${window.location.origin}/m/${id}`)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '28px 20px 80px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ color: '#1a1a2e', margin: 0 }}>{materialId ? '안내자료 수정' : '안내자료 만들기'}</h2>
        <button style={btnGhost} onClick={() => router.push('/materials')}>목록으로</button>
      </div>

      <input
        value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목 (예: 법인전환 가이드)"
        style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #D3D1C7', fontSize: 16, fontWeight: 700, boxSizing: 'border-box', marginBottom: 16 }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {blocks.map((block, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 10, padding: 14, boxShadow: '0 2px 10px rgba(0,0,0,0.05)', position: 'relative' }}>
            <button onClick={() => removeBlock(i)} style={{ position: 'absolute', top: 8, right: 10, background: 'none', border: 'none', color: '#B0AEA5', fontSize: 16, cursor: 'pointer' }}>×</button>
            {block.type === 'text' ? (
              <textarea
                value={block.content} onChange={(e) => updateText(i, e.target.value)} placeholder="내용을 입력하세요"
                style={{ width: '100%', minHeight: 90, padding: '8px 10px', border: '1px solid #E4E2DB', borderRadius: 6, fontSize: 13.5, boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }}
              />
            ) : (
              <img src={block.url} alt="" style={{ width: '100%', borderRadius: 6, display: 'block' }} />
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button style={btnGhost} onClick={addText}>+ 텍스트 추가</button>
        <button style={btnGhost} onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? '업로드 중…' : '+ 이미지 추가'}
        </button>
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" style={{ display: 'none' }} onChange={(e) => e.target.files[0] && addImage(e.target.files[0])} />
      </div>

      {error && <p style={{ color: '#C0392B', fontSize: 13, margin: '0 0 12px' }}>{error}</p>}

      {saved ? (
        <div style={{ background: '#E1F5EE', borderRadius: 10, padding: '14px 16px' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#085041', margin: '0 0 6px' }}>✓ 저장 완료</p>
          <p style={{ fontSize: 12.5, color: '#2A2925', margin: '0 0 8px', wordBreak: 'break-all' }}>{saved}</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btn} onClick={() => navigator.clipboard.writeText(saved)}>링크 복사</button>
            <button style={btnGhost} onClick={() => router.push('/materials')}>목록으로</button>
          </div>
        </div>
      ) : (
        <button style={{ ...btn, width: '100%' }} disabled={saving} onClick={save}>{saving ? '저장 중…' : '저장'}</button>
      )}
    </div>
  )
}
