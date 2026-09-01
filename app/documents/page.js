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
      <AppHeader user={user} />
      <div style={{ padding: '32px 40px', maxWidth: 640, margin: '0 auto' }}>
        <p style={{ fontSize: 13, color: '#8A8A85', margin: '0 0 4px' }}>서류 발급</p>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 6px', color: '#2A2925' }}>
          국세청 서류 자동 발급
        </h1>
        <p style={{ fontSize: 13, color: '#8A8A85', margin: '0 0 24px' }}>
          고객 본인 인증(카카오톡 등)으로 사업자등록증명 등을 바로 발급받습니다.
          등록된 고객을 고르면 그 고객 파일함에 자동 저장되고, 아직 등록 전인 상담이면
          고객 선택 없이 발급받아 이 화면에서 바로 다운로드할 수 있습니다.
        </p>

        <div style={{ background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
          <CodefDocumentIssuance
            consultantUsername={user.username}
            customerPicker
            customers={customers}
          />
        </div>
      </div>
    </div>
  );
}
