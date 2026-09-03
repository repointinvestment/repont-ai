'use client';

// app/resources/page.js
// 자료실 — 문수환 대표가 컨설턴트들에게 공유하는 강의자료(PPT/PDF/엑셀/이미지) 다운로드 저장소.
// 학습센터(공지·질문)와 성격이 달라 분리 — 여기는 순수 파일만, 글(텍스트 게시물) 없음.

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/session';
import AppHeader from '../components/AppHeader';

const TYPE_ICON = {
  pdf: '📕', ppt: '📙', pptx: '📙', xls: '📗', xlsx: '📗',
  png: '🖼️', jpg: '🖼️', jpeg: '🖼️', webp: '🖼️',
};
function iconFor(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  return TYPE_ICON[ext] || '📄';
}
function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export default function ResourcesPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [pending, setPending] = useState([]); // 업로드 전 대기 목록: [{file, description}]
  const [editingDesc, setEditingDesc] = useState(null); // 이미 올라간 파일의 설명 수정 중인 id
  const [editText, setEditText] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    const s = getSession();
    if (!s) { router.push('/'); return; }
    setUser(s);
    load(s);
  }, []);

  async function load(s = user) {
    try {
      const res = await fetch('/api/resources');
      const data = await res.json();
      setFiles(data.files || []);
    } catch {
      setError('자료 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  function stageFiles(fileList) {
    const selected = Array.from(fileList || []);
    if (selected.length === 0) return;
    setPending((prev) => [...prev, ...selected.map((file) => ({ file, description: '' }))]);
    setError(null);
  }

  function updatePendingDesc(idx, description) {
    setPending((prev) => prev.map((p, i) => (i === idx ? { ...p, description } : p)));
  }

  function removePending(idx) {
    setPending((prev) => prev.filter((_, i) => i !== idx));
  }

  async function confirmUpload() {
    if (pending.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const { file, description } of pending) {
        const formData = new FormData();
        formData.append('file', file);
        if (description) formData.append('description', description);
        const res = await fetch('/api/resources', {
          method: 'POST',
          headers: { 'x-consultant-id': user.username, 'x-consultant-role': user.role },
          body: formData,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || '업로드 실패');
        }
      }
      setPending([]);
      await load();
    } catch (err) {
      setError(err.message || '자료 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  }

  function startEditDesc(f) {
    setEditingDesc(f.id);
    setEditText(f.description || '');
  }

  async function saveEditDesc(f) {
    await fetch(`/api/resources/${f.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-consultant-id': user.username, 'x-consultant-role': user.role },
      body: JSON.stringify({ description: editText }),
    });
    setEditingDesc(null);
    load();
  }

  // 파일명 클릭 = 다운로드 버튼과 동일하게 실제 저장 (미리보기로 열리기만 하고 안 받아지던 문제 방지)
  async function handleDownload(f) {
    try {
      const res = await fetch(`/api/resources/${f.id}/download`, { headers: { 'x-consultant-id': user.username } });
      if (!res.ok) throw new Error('다운로드 실패');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = f.file_name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('자료를 다운로드하는 중 오류가 발생했습니다.');
    }
  }

  async function handleDelete(f) {
    if (!confirm(`"${f.file_name}"을(를) 삭제할까요?`)) return;
    await fetch(`/api/resources/${f.id}`, { method: 'DELETE', headers: { 'x-consultant-id': user.username, 'x-consultant-role': user.role } });
    load();
  }

  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#F7F5F0' }}>
      <AppHeader user={user} />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 20px 60px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h2 style={{ color: '#1a1a2e', margin: 0 }}>자료실</h2>
          {user.role === 'admin' && (
            <div>
              <input ref={fileInputRef} type="file" multiple accept=".pdf,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.webp" style={{ display: 'none' }} onChange={(e) => { stageFiles(e.target.files); e.target.value = ''; }} />
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: '#D85A30', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                + 자료 선택
              </button>
            </div>
          )}
        </div>
        <p style={{ fontSize: 13, color: '#8A8A85', margin: '0 0 20px' }}>강의자료·양식 등 대표가 공유하는 PPT·PDF·엑셀·이미지 파일입니다.</p>

        {error && <p style={{ color: '#C0392B', fontSize: 13, margin: '0 0 14px' }}>{error}</p>}

        {user.role === 'admin' && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => { e.preventDefault(); setDragActive(false); stageFiles(e.dataTransfer.files); }}
            style={{ border: `2px dashed ${dragActive ? '#D85A30' : '#E0DFDA'}`, borderRadius: 12, padding: '20px', textAlign: 'center', marginBottom: 20, background: dragActive ? '#FFF6F2' : '#fff', fontSize: 13, color: '#8A8A85' }}
          >
            파일을 여기로 끌어다 놓아도 선택됩니다
          </div>
        )}

        {pending.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.05)', padding: '16px 18px', marginBottom: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#2A2925', margin: '0 0 12px' }}>업로드 대기 중 ({pending.length}개) — 설명은 선택사항입니다</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pending.map((p, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{iconFor(p.file.name)}</span>
                  <span style={{ fontSize: 13, color: '#2A2925', flexShrink: 0, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.file.name}</span>
                  <input
                    value={p.description}
                    onChange={(e) => updatePendingDesc(idx, e.target.value)}
                    placeholder="이 자료가 뭔지 짧게 설명 (선택)"
                    style={{ flex: 1, padding: '7px 10px', borderRadius: 7, border: '1px solid #D3D1C7', fontSize: 12.5, boxSizing: 'border-box' }}
                  />
                  <button onClick={() => removePending(idx)} style={{ background: 'none', border: 'none', color: '#B0AEA5', fontSize: 16, cursor: 'pointer', flexShrink: 0 }}>×</button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button onClick={() => setPending([])} disabled={uploading} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #2A2925', background: '#fff', color: '#2A2925', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>취소</button>
              <button onClick={confirmUpload} disabled={uploading} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#D85A30', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                {uploading ? '업로드 중...' : `${pending.length}개 업로드`}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p style={{ fontSize: 13, color: '#B0AEA5' }}>불러오는 중...</p>
        ) : files.length === 0 ? (
          <p style={{ fontSize: 13, color: '#B0AEA5' }}>아직 올라온 자료가 없습니다.</p>
        ) : (
          <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            {files.map((f, i) => (
              <div key={f.id} style={{ padding: '14px 18px', borderTop: i === 0 ? 'none' : '1px solid #F0EFEA' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{iconFor(f.file_name)}</span>
                  <button onClick={() => handleDownload(f)} style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 14, color: '#2A2925', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.file_name}
                  </button>
                  <span style={{ fontSize: 11.5, color: '#B0AEA5', flexShrink: 0 }}>{formatSize(f.size_bytes)}</span>
                  <button onClick={() => handleDownload(f)} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid #2A2925', background: '#fff', color: '#2A2925', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>다운로드</button>
                  {user.role === 'admin' && (
                    <button onClick={() => handleDelete(f)} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid #C0392B', background: '#fff', color: '#C0392B', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>삭제</button>
                  )}
                </div>
                {editingDesc === f.id ? (
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, paddingLeft: 32 }}>
                    <input value={editText} onChange={(e) => setEditText(e.target.value)} autoFocus
                      style={{ flex: 1, padding: '6px 9px', borderRadius: 6, border: '1px solid #D3D1C7', fontSize: 12.5, boxSizing: 'border-box' }} />
                    <button onClick={() => saveEditDesc(f)} style={{ fontSize: 12, color: '#2A2925', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>저장</button>
                    <button onClick={() => setEditingDesc(null)} style={{ fontSize: 12, color: '#B0AEA5', background: 'none', border: 'none', cursor: 'pointer' }}>취소</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, paddingLeft: 32 }}>
                    {f.description
                      ? <p style={{ fontSize: 12.5, color: '#8A8A85', margin: 0 }}>{f.description}</p>
                      : user.role === 'admin' && <p style={{ fontSize: 12, color: '#C4C2B8', margin: 0 }}>설명 없음</p>}
                    {user.role === 'admin' && (
                      <button onClick={() => startEditDesc(f)} style={{ fontSize: 11, color: '#B0AEA5', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                        {f.description ? '수정' : '설명 추가'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
