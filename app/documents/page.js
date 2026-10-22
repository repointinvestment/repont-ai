'use client';

// app/documents/page.js
// 메인 메뉴 "서류 발급" 카드에서 들어오는 실제 서비스 화면.
// 고객을 고르면 그 고객 파일함에 자동 저장되고, 신규 상담 등 아직 고객 등록 전이면
// 고객 선택 없이 발급받아 로컬로 바로 다운로드만 할 수도 있음.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/session';
import AppHeader from '../components/AppHeader';
import CodefDocumentIssuance from '../components/CodefDocumentIssuance';

const STEPS = [
  ['서류 선택', '필요한 서류를 체크합니다. 홈택스 서류는 여러 개를 골라도 인증은 한 번입니다.'],
  ['고객 인증', '고객 휴대폰으로 카카오톡 등 간편인증 요청이 갑니다. 고객은 승인만 누르면 됩니다.'],
  ['자동 저장', '발급된 PDF가 고객 파일함에 저장되고, 사업자 이력·매출·체납 여부가 바로 정리됩니다.'],
];

export default function DocumentsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    const s = getSession();
    if (!s) { router.push('/'); return; }
    setUser(s);
    fetch('/api/customers', { headers: { 'x-consultant-id': s.username, 'x-consultant-role': s.role } })
      .then((r) => r.json())
      .then((d) => setCustomers(d.customers || []))
      .catch(() => {});
  }, []);

  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#F7F5F0' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@500;700;900&display=swap');
        .docs-wrap{max-width:1040px;margin:0 auto;padding:0 24px 56px}
        .docs-cols{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:20px;margin-top:-34px}
        .docs-side{position:sticky;top:20px;align-self:start}
        @media (max-width:900px){.docs-cols{grid-template-columns:1fr}.docs-side{position:static}}
      `}</style>
      <AppHeader user={user} />

      {/* 히어로 */}
      <div style={{ background: 'linear-gradient(180deg, #0B2440 0%, #0E2C4C 100%)', padding: '40px 24px 64px' }}>
        <div style={{ maxWidth: 1040, margin: '0 auto' }}>
          <p style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 12, letterSpacing: '0.25em', color: '#B4923F', fontWeight: 700, margin: '0 0 10px' }}>
            DOCUMENT ISSUANCE · 서류 발급
          </p>
          <h1 style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 'clamp(24px, 3.6vw, 32px)', color: '#FBF7EE', fontWeight: 700, margin: '0 0 10px', lineHeight: 1.35 }}>
            국세청·정부24 서류, 고객 인증 한 번으로 바로 발급
          </h1>
          <p style={{ fontSize: 14, color: '#8FA6C0', margin: 0, lineHeight: 1.7, maxWidth: 680 }}>
            사업자등록증명·부가세과세표준증명·납세증명서·재무제표·지방세 납세증명서를 고객이 직접 떼서 보내줄 필요 없이,
            상담 자리에서 카카오톡 인증 한 번으로 받습니다. 등록된 고객을 고르면 파일함에 자동 저장됩니다.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 18 }}>
            {['5종 서류', '인증 1번', 'PDF 자동 저장', '폐업 이력·매출 즉시 정리'].map((t) => (
              <span key={t} style={{ border: '1px solid rgba(233,201,121,.6)', color: '#E9C979', borderRadius: 999, padding: '4px 12px', fontSize: 12.5, fontWeight: 700 }}>{t}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="docs-wrap">
        <div className="docs-cols">
          <div style={{ background: '#fff', borderRadius: 16, padding: '26px 26px 28px', boxShadow: '0 8px 30px rgba(11,36,64,.08)', border: '1px solid #E9E6DD' }}>
            <CodefDocumentIssuance
              consultantUsername={user.username}
              customerPicker
              customers={customers}
            />
          </div>

          <aside className="docs-side">
            <div style={{ background: '#fff', borderRadius: 16, padding: '20px 20px 18px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', border: '1px solid #E9E6DD' }}>
              <p style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 14.5, fontWeight: 700, color: '#0B2440', margin: '0 0 14px' }}>이렇게 진행됩니다</p>
              {STEPS.map(([t, d], i) => (
                <div key={t} style={{ display: 'flex', gap: 12, marginBottom: i < STEPS.length - 1 ? 14 : 0 }}>
                  <span style={{ flex: 'none', width: 26, height: 26, borderRadius: '50%', background: '#F3EEDF', color: '#0B2440', fontWeight: 800, fontSize: 12.5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Noto Serif KR', serif" }}>{i + 1}</span>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1d2733' }}>{t}</div>
                    <div style={{ fontSize: 12.5, color: '#6B7480', lineHeight: 1.6, marginTop: 2 }}>{d}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, background: '#FBF8EE', border: '1px solid #EADFC0', borderRadius: 14, padding: '14px 16px', fontSize: 12.5, color: '#5F5E5A', lineHeight: 1.7 }}>
              <b style={{ color: '#0B2440' }}>알아두세요</b><br />
              · 홈택스 서류는 <b>08:00~22:00</b>에만 발급됩니다.<br />
              · 부가세과세표준증명은 고객이 홈택스 회원이어야 합니다.<br />
              · 지방세 납세증명서는 정부24라서 인증을 한 번 더 받습니다.<br />
              · 고객 인증서·비밀번호는 어디에도 저장하지 않습니다.
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
