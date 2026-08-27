'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getSession } from '@/lib/session';
import AppHeader from '../../components/AppHeader';

export default function BoardPostPage() {
  const router = useRouter();
  const params = useParams();
  const [user, setUser] = useState(null);
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [files, setFiles] = useState([]);
  const [commentInput, setCommentInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (!session) { router.push('/'); return; }
    setUser(session);
    load();
  }, []);

  async function load() {
    try {
      const res = await fetch(`/api/board/posts/${params.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error();
      setPost(data.post);
      setComments(data.comments || []);
      setFiles(data.files || []);
    } catch (err) {
      setError('게시글을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function handleComment(e) {
    e.preventDefault();
    if (!commentInput.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/board/posts/${params.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-consultant-id': user?.username || '',
          'x-consultant-role': user?.role || '',
        },
        body: JSON.stringify({ content: commentInput, authorName: user?.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setComments((c) => [...c, data.comment]);
      setCommentInput('');
    } catch (err) {
      setError('댓글 등록 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeletePost() {
    if (!confirm('이 게시글을 삭제하시겠어요?')) return;
    try {
      const res = await fetch(`/api/board/posts/${params.id}`, {
        method: 'DELETE',
        headers: { 'x-consultant-id': user?.username || '', 'x-consultant-role': user?.role || '' },
      });
      if (!res.ok) throw new Error();
      router.push('/board');
    } catch (err) {
      setError('삭제 중 오류가 발생했습니다.');
    }
  }

  async function handleFileOpen(f) {
    try {
      const res = await fetch(`/api/board/files/${f.id}/download`, {
        headers: { 'x-consultant-id': user?.username || '' },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, '_blank');
    } catch (err) {
      setError('파일을 여는 중 오류가 발생했습니다.');
    }
  }

  if (!user) return null;

  const canDeletePost = post && (post.author_username === user.username || user.role === 'admin');
  const isNotice = post && post.author_role === 'admin';

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <AppHeader user={user} />
      <div style={{ padding: '32px 40px', maxWidth: 720, margin: '0 auto' }}>
        {loading && <p style={{ fontSize: 14, color: '#8A8A85' }}>불러오는 중...</p>}
        {!loading && post && (
          <>
            <button onClick={() => router.push('/board')} style={{ background: 'none', border: 'none', color: '#8A8A85', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 16 }}>
              ← 목록으로
            </button>

            <div style={{ background: isNotice ? '#FAECE7' : '#fff', border: isNotice ? '1.5px solid #D85A30' : '1px solid #E4E2DB', borderRadius: 12, padding: '24px 28px', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                {isNotice && (
                  <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 20, background: '#D85A30', color: '#fff' }}>공지</span>
                )}
                <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: '#2A2925' }}>{post.title}</h1>
              </div>
              <p style={{ fontSize: 13, color: '#8A8A85', margin: '0 0 18px' }}>
                {post.author_name} · {new Date(post.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })}
              </p>
              <p style={{ fontSize: 14, color: '#2A2925', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>{post.content}</p>

              {files.length > 0 && (
                <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {files.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => handleFileOpen(f)}
                      style={{ textAlign: 'left', padding: '10px 14px', border: '1px solid #E4E2DB', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer' }}
                    >
                      📎 {f.file_name}
                    </button>
                  ))}
                </div>
              )}

              {canDeletePost && (
                <div style={{ marginTop: 20 }}>
                  <button onClick={handleDeletePost} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #E4B3A5', background: '#fff', color: '#A32D2D', fontSize: 12, cursor: 'pointer' }}>
                    삭제
                  </button>
                </div>
              )}
            </div>

            <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 12px', color: '#2A2925' }}>댓글 {comments.length}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {comments.map((c) => (
                <div key={c.id} style={{ background: c.author_role === 'admin' ? '#FAECE7' : '#fff', border: '1px solid #E4E2DB', borderRadius: 8, padding: '12px 16px' }}>
                  <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 4px', color: '#2A2925' }}>
                    {c.author_name}
                    {c.author_role === 'admin' && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 20, background: '#D85A30', color: '#fff' }}>운영자</span>}
                    <span style={{ marginLeft: 8, fontSize: 12, color: '#8A8A85', fontWeight: 400 }}>
                      {new Date(c.created_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                    </span>
                  </p>
                  <p style={{ fontSize: 14, color: '#2A2925', margin: 0, whiteSpace: 'pre-wrap' }}>{c.content}</p>
                </div>
              ))}
            </div>

            <form onSubmit={handleComment} style={{ display: 'flex', gap: 8 }}>
              <input
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="댓글을 입력하세요"
                style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #D3D1C7', fontSize: 14 }}
              />
              <button
                type="submit"
                disabled={submitting}
                style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: submitting ? '#ccc' : '#D85A30', color: '#fff', fontSize: 14, fontWeight: 600, cursor: submitting ? 'default' : 'pointer' }}
              >
                등록
              </button>
            </form>

            {error && <p style={{ fontSize: 13, color: '#A32D2D', marginTop: 12 }}>{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
