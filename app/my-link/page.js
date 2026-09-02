'use client';

// app/my-link/page.js
// "내 자가진단 링크" 전용 페이지. 기존엔 메인메뉴 상단에 항상 떠 있던 배너였는데,
// 매일 쓰는 기능이 아니라 SNS·블로그에 가끔 붙여넣는 용도라 다른 기능들처럼 카드+전용 페이지로 분리.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/session';
import AppHeader from '../components/AppHeader';

export default function MyLinkPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [copied, setCopied] = useState(false);
  const [leadCount, setLeadCount] = useState(null);

  useEffect(() => {
    const s = getSession();
    if (!s) { router.push('/'); return; }
    setUser(s);
    fetch('/api/customers', { headers: { 'x-consultant-id': s.username, 'x-consultant-role': s.role } })
      .then((r) => r.json())
      .then((d) => setLeadCount((d.customers || []).filter((c) => c.memo === '자가진단 공개 링크로 유입').length))
      .catch(() => {});
  }, []);

  if (!user) return null;
  const url = typeof window !== 'undefined' ? `${window.location.origin}/apply/${user.username}` : '';

  return (
    <div style={{ minHeight: '100vh', background: '#F7F6F2' }}>
      <AppHeader user={user} />
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '28px 20px 60px' }}>
        <h2 style={{ color: '#1a1a2e', margin: '0 0 4px' }}>내 자가진단 링크</h2>
        <p style={{ fontSize: 13, color: '#8A8A85', margin: '0 0 24px' }}>
          로그인 없이 누구나 열어서 업종·업력·매출을 입력하면, 간단한 진단 결과를 보여주고 자동으로 내 고객관리에 리드로 등록됩니다.
          블로그, SNS 프로필, 명함, 문자 발송 등에 붙여넣어 쓰세요.
        </p>

        <div style={{ background: '#fff', borderRadius: 14, padding: 22, boxShadow: '0 2px 12px rgba(0,0,0,0.05)', marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: '#8A8A85', margin: '0 0 8px', fontWeight: 600 }}>내 링크</p>
          <div style={{ background: '#F7F5F0', borderRadius: 10, padding: '14px 16px', fontSize: 14, color: '#2A2925', wordBreak: 'break-all', marginBottom: 12, fontFamily: 'monospace' }}>
            {url}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              style={{ flex: 1, padding: '11px', borderRadius: 8, border: 'none', background: '#2A2925', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
              {copied ? '복사됨 ✓' : '링크 복사'}
            </button>
            <button
              onClick={() => window.open(url, '_blank')}
              style={{ flex: 1, padding: '11px', borderRadius: 8, border: '1px solid #2A2925', background: '#fff', color: '#2A2925', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
              미리보기
            </button>
          </div>
        </div>

        {leadCount !== null && (
          <div style={{ background: '#fff', borderRadius: 14, padding: '16px 20px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#5F5E5A' }}>이 링크로 들어온 리드</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#2A2925' }}>{leadCount}명</span>
          </div>
        )}

        <p style={{ fontSize: 11, color: '#B0AEA5', margin: '16px 0 0', lineHeight: 1.6 }}>
          * 방문자가 입력한 정보는 "고객관리"에 상담중 상태로 자동 등록됩니다. 메모에 "자가진단 공개 링크로 유입"이라고 표시되니 필터해서 찾을 수 있어요.
        </p>
      </div>
    </div>
  );
}
