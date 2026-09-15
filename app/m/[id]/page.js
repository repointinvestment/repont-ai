'use client';

// app/m/[id]/page.js
// 고객이 카톡 링크로 들어와서 보는 안내자료 공개 페이지. 로그인 불필요.
// ?t=토큰 있으면(기존 고객) 문의하기 눌렀을 때 자동으로 그 고객 기록에 남고,
// 토큰 없으면(낯선 사람이 공유받아 봄) 이름·연락처 입력폼이 떠서 새 리드로 등록됨.

import { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { renderFormattedText } from '@/lib/materialFormat';

const INK = '#17261F';
const ACCENT_DEEP = '#1F4E39';
const PAPER = '#FBF8F2';
const LINE = '#E4E0D3';

function MaterialViewInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = searchParams.get('t');

  const [status, setStatus] = useState('loading'); // loading | invalid | ready
  const [material, setMaterial] = useState(null);
  const [inquireState, setInquireState] = useState('idle'); // idle | needName | sending | done
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`/api/public/materials/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.material) { setStatus('invalid'); return; }
        setMaterial(d.material);
        setStatus('ready');
      })
      .catch(() => setStatus('invalid'));
  }, [params.id]);

  async function submitInquiry(withDetails) {
    setInquireState('sending');
    setError(null);
    try {
      const res = await fetch(`/api/public/materials/${params.id}/inquire`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withDetails ? { name, phone } : { token }),
      });
      const d = await res.json();
      if (d.error === 'needName') { setInquireState('needName'); return; }
      if (!res.ok) throw new Error(d.error || '문의 접수 실패');
      setInquireState('done');
    } catch (e) {
      setError(e.message);
      setInquireState(withDetails ? 'needName' : 'idle');
    }
  }

  if (status === 'loading') return <div style={{ minHeight: '100vh', background: PAPER }} />;
  if (status === 'invalid') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: PAPER, fontFamily: "'Noto Sans KR', sans-serif" }}>
        <p style={{ fontSize: 15, color: '#8A8A85' }}>존재하지 않는 자료입니다.</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: PAPER, fontFamily: "'Noto Sans KR', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@700;900&family=Noto+Sans+KR:wght@400;500;600;700&display=swap');`}</style>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '40px 20px 60px' }}>
        <p style={{ fontFamily: "'Noto Serif KR', serif", fontWeight: 900, fontSize: 13, letterSpacing: '0.04em', color: ACCENT_DEEP, margin: '0 0 16px', textAlign: 'center' }}>
          머니콕
        </p>
        <h1 style={{ fontFamily: "'Noto Serif KR', serif", fontWeight: 900, color: INK, fontSize: 24, lineHeight: 1.4, margin: '0 0 24px' }}>
          {material.title}
        </h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 30 }}>
          {(material.blocks || []).map((block, i) => (
            block.type === 'image' ? (
              <img key={i} src={block.url} alt="" style={{ width: '100%', borderRadius: 12, display: 'block' }} />
            ) : (
              <p key={i} style={{
                fontSize: block.heading ? 20 : 15, fontWeight: block.heading ? 800 : 400, fontFamily: block.heading ? "'Noto Serif KR', serif" : "'Noto Sans KR', sans-serif",
                color: INK, lineHeight: block.heading ? 1.5 : 1.8, margin: 0, whiteSpace: 'pre-wrap',
              }}>
                {renderFormattedText(block.content)}
              </p>
            )
          ))}
        </div>

        <div style={{ background: '#fff', borderRadius: '18px', padding: 22, border: `1px solid ${LINE}` }}>
          {inquireState === 'done' ? (
            <p style={{ fontSize: 14, fontWeight: 700, color: ACCENT_DEEP, textAlign: 'center', margin: 0 }}>✓ 문의 접수했어요, 곧 연락드릴게요</p>
          ) : inquireState === 'needName' ? (
            <>
              <p style={{ fontSize: 13, color: '#5C6B62', margin: '0 0 12px' }}>연락드릴 정보를 남겨주세요.</p>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름" style={{ width: '100%', padding: '11px 13px', borderRadius: 8, border: `1.5px solid ${LINE}`, fontSize: 14, boxSizing: 'border-box', marginBottom: 10 }} />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="연락처 (010-0000-0000)" style={{ width: '100%', padding: '11px 13px', borderRadius: 8, border: `1.5px solid ${LINE}`, fontSize: 14, boxSizing: 'border-box', marginBottom: 12 }} />
              {error && <p style={{ color: '#C0392B', fontSize: 12.5, margin: '0 0 10px' }}>{error}</p>}
              <button onClick={() => submitInquiry(true)} disabled={inquireState === 'sending' || !name || !phone} style={{ width: '100%', padding: 14, borderRadius: 10, border: 'none', background: ACCENT_DEEP, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                문의하기
              </button>
            </>
          ) : (
            <button onClick={() => submitInquiry(false)} disabled={inquireState === 'sending'} style={{ width: '100%', padding: 14, borderRadius: 10, border: 'none', background: ACCENT_DEEP, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              {inquireState === 'sending' ? '접수 중…' : '문의하기'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MaterialViewPage() {
  return (
    <Suspense fallback={null}>
      <MaterialViewInner />
    </Suspense>
  );
}
