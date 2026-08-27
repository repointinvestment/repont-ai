'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/session';
import AppHeader from '../../components/AppHeader';

export default function NewBoardPostPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const session = getSession();
    if (!session) { router.push('/'); return; }
    setUser(session);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError('제목과 내용을 입력해주세요.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/board/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-consultant-id': user?.username || '',
          'x-consultant-role': user?.role || '',
        },
        body: JSON.stringify({ title, content, authorName: user?.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '등록 실패');
      const postId = data.post.id;

      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        await fetch(`/api/board/posts/${postId}/files`, {
          method: 'POST',
          headers: { 'x-consultant-id': user?.username || '' },
          body: formData,
        });
      }

      router.push(`/board/${postId}`);
    } catch (err) {
      setError(err.message || '등록 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  const inputStyle = { width: '100%', padding: '11px 13px', border: '1px solid #D3D1C7', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' };
  const labelStyle = { fontSize: 13, color: '#5F5E5A', display: 'block', marginBottom: 6, fontWeight: 600 };

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <AppHeader user={user} />
      <div style={{ padding: '32px 40px', maxWidth: 720, margin: '0 auto' }}>
        <p style={{ fontSize: 13, color: '#8A8A85', margin: '0 0 4px' }}>학습센터</p>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 20px', color: '#2A2925' }}>글쓰기</h1>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label>
            <span style={labelStyle}>제목</span>
            <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목을 입력하세요" />
          </label>
          <label>
            <span style={labelStyle}>내용</span>
            <textarea style={{ ...inputStyle, minHeight: 220, resize: 'vertical' }} value={content} onChange={(e) => setContent(e.target.value)} placeholder="시장 상황, 노하우, 질문 등을 자유롭게 작성하세요" />
          </label>
          <label>
            <span style={labelStyle}>파일 첨부 (선택)</span>
            <input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} />
          </label>

          {error && <p style={{ fontSize: 13, color: '#A32D2D', margin: 0 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              type="submit"
              disabled={saving}
              style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: saving ? '#ccc' : '#D85A30', color: '#fff', fontSize: 14, fontWeight: 600, cursor: saving ? 'default' : 'pointer' }}
            >
              {saving ? '등록 중...' : '등록하기'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/board')}
              style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #D3D1C7', background: '#fff', fontSize: 14, cursor: 'pointer' }}
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
