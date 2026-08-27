'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/session';
import AppHeader from '../components/AppHeader';

export default function BoardListPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = getSession();
    if (!session) { router.push('/'); return; }
    setUser(session);

    fetch('/api/board/posts')
      .then((r) => r.json())
      .then((d) => setPosts(d.posts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <AppHeader user={user} />
      <div style={{ padding: '32px 40px', maxWidth: 880, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div>
            <p style={{ fontSize: 13, color: '#8A8A85', margin: '0 0 4px' }}>학습센터</p>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: '#2A2925' }}>공지 · 게시판 · QnA</h1>
          </div>
          <button
            onClick={() => router.push('/board/new')}
            style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: '#D85A30', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            + 글쓰기
          </button>
        </div>
        <p style={{ fontSize: 14, color: '#8A8A85', margin: '0 0 24px' }}>
          시장 상황, 노하우, 질문을 자유롭게 나누는 공간이에요. 대표님 공지는 강조되어 표시됩니다.
        </p>

        {loading && <p style={{ fontSize: 14, color: '#8A8A85' }}>불러오는 중...</p>}
        {!loading && posts.length === 0 && <p style={{ fontSize: 14, color: '#8A8A85' }}>아직 게시글이 없습니다. 첫 글을 남겨보세요!</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {posts.map((post) => {
            const isNotice = post.author_role === 'admin';
            return (
              <div
                key={post.id}
                onClick={() => router.push(`/board/${post.id}`)}
                style={{
                  background: isNotice ? '#FAECE7' : '#fff',
                  border: isNotice ? '1.5px solid #D85A30' : '1px solid #E4E2DB',
                  borderRadius: 12, padding: '16px 20px', cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  {isNotice && (
                    <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 20, background: '#D85A30', color: '#fff' }}>
                      공지
                    </span>
                  )}
                  <p style={{ fontSize: 15, fontWeight: 700, margin: 0, color: '#2A2925' }}>{post.title}</p>
                </div>
                <p style={{ fontSize: 13, color: '#8A8A85', margin: 0 }}>
                  {post.author_name} · {new Date(post.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                  {post.comment_count > 0 && ` · 댓글 ${post.comment_count}`}
                  {post.file_count > 0 && ` · 첨부 ${post.file_count}`}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
