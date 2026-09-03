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

  async function uploadFiles(fileList) {
    const selected = Array.from(fileList || []);
    if (selected.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of selected) {
        const formData = new FormData();
        formData.append('file', file);
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
      await load();
    } catch (err) {
      setError(err.message || '자료 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
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
              <input ref={fileInputRef} type="file" multiple accept=".pdf,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.webp" style={{ display: 'none' }} onChange={(e) => uploadFiles(e.target.files)} />
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: '#D85A30', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {uploading ? '업로드 중...' : '+ 자료 업로드'}
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
            onDrop={(e) => { e.preventDefault(); setDragActive(false); uploadFiles(e.dataTransfer.files); }}
            style={{ border: `2px dashed ${dragActive ? '#D85A30' : '#E0DFDA'}`, borderRadius: 12, padding: '20px', textAlign: 'center', marginBottom: 20, background: dragActive ? '#FFF6F2' : '#fff', fontSize: 13, color: '#8A8A85' }}
          >
            파일을 여기로 끌어다 놓아도 업로드됩니다
          </div>
        )}

        {loading ? (
          <p style={{ fontSize: 13, color: '#B0AEA5' }}>불러오는 중...</p>
        ) : files.length === 0 ? (
          <p style={{ fontSize: 13, color: '#B0AEA5' }}>아직 올라온 자료가 없습니다.</p>
        ) : (
          <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            {files.map((f, i) => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderTop: i === 0 ? 'none' : '1px solid #F0EFEA' }}>
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
