'use client';

// app/join/[token]/page.js
// 신청(구독) 페이지 — 문자로 받은 개인 링크로 들어와서 "신청하기" 버튼 누르면 끝.
// 이 클릭이 카카오가 요구하는 "수신자 본인의 액션"이 되어, 이후 정책자금 소식 알림톡을 보낼 수 있게 됨.

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const INK = '#17261F';
const ACCENT_DEEP = '#1F4E39';
const ACCENT_SOFT = '#E3EFE6';
const PAPER = '#FBF8F2';
const LINE = '#E4E0D3';

export default function JoinPage() {
  const params = useParams();
  const [status, setStatus] = useState('loading'); // loading | invalid | ready | done
  const [ownerName, setOwnerName] = useState('');
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    fetch(`/api/public/subscribe?t=${params.token}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.ownerName) { setStatus('invalid'); return; }
        setOwnerName(d.ownerName);
        setStatus(d.subscribed ? 'done' : 'ready');
      })
      .catch(() => setStatus('invalid'));
  }, [params.token]);

  async function subscribe() {
    setSubscribing(true);
    try {
      await fetch('/api/public/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: params.token }),
      });
      setStatus('done');
    } finally {
      setSubscribing(false);
    }
  }

  if (status === 'loading') return <div style={{ minHeight: '100vh', background: PAPER }} />;
  if (status === 'invalid') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: PAPER, fontFamily: "'Noto Sans KR', sans-serif" }}>
        <p style={{ fontSize: 15, color: '#8A8A85' }}>유효하지 않은 링크입니다.</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: PAPER, fontFamily: "'Noto Sans KR', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@700;900&family=Noto+Sans+KR:wght@400;500;600;700&display=swap');`}</style>
      <div style={{ maxWidth: 380, padding: '40px 24px', textAlign: 'center' }}>
        <p style={{ fontFamily: "'Noto Serif KR', serif", fontWeight: 900, fontSize: 14, letterSpacing: '0.04em', color: ACCENT_DEEP, margin: '0 0 18px' }}>머니콕</p>

        {status === 'done' ? (
          <>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: ACCENT_SOFT, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', fontSize: 26 }}>✓</div>
            <h1 style={{ fontFamily: "'Noto Serif KR', serif", fontWeight: 900, fontSize: 20, color: INK, margin: '0 0 10px' }}>신청 완료됐어요</h1>
            <p style={{ fontSize: 13.5, color: '#5C6B62', lineHeight: 1.7, margin: 0 }}>
              {ownerName}님, 앞으로 정책자금·지원금 새 소식이 있을 때 카카오톡으로 알려드릴게요.
            </p>
          </>
        ) : (
          <>
            <h1 style={{ fontFamily: "'Noto Serif KR', serif", fontWeight: 900, fontSize: 22, color: INK, lineHeight: 1.4, margin: '0 0 12px' }}>
              {ownerName}님,<br />정책자금·지원금 소식을<br />카톡으로 받아보시겠어요?
            </h1>
            <p style={{ fontSize: 13.5, color: '#5C6B62', lineHeight: 1.7, margin: '0 0 26px' }}>
              새로운 지원사업·자금 공고가 뜰 때마다 놓치지 않고 알려드려요. 신청은 무료이고, 언제든 그만 받으실 수 있어요.
            </p>
            <button
              onClick={subscribe} disabled={subscribing}
              style={{
                width: '100%', padding: '15px', borderRadius: 12, border: 'none', background: ACCENT_DEEP, color: '#fff',
                fontSize: 16, fontWeight: 700, cursor: subscribing ? 'default' : 'pointer', boxShadow: '0 8px 20px rgba(31,78,57,0.28)',
              }}
            >
              {subscribing ? '신청 중…' : '신청하기'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
