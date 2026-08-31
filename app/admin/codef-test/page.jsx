'use client';

// app/admin/codef-test/page.jsx
// CODEF 연동 자유 테스트용 화면 (admin 전용). 실제 발급/저장 로직은 app/components/CodefDocumentIssuance.jsx 공용 컴포넌트를 그대로 씀.
// 실제 고객 화면은 /customers/[id] 안에 같은 컴포넌트가 내장되어 있음.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/session';
import AppHeader from '../../components/AppHeader';
import CodefDocumentIssuance from '../../components/CodefDocumentIssuance';

export default function CodefTestPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    const s = getSession();
    if (!s) { router.push('/'); return; }
    if (s.role !== 'admin') { router.push('/menu'); return; }
    setUser(s);
    fetch('/api/customers', { headers: { 'x-consultant-id': s.username, 'x-consultant-role': s.role } })
      .then((r) => r.json())
      .then((d) => setCustomers(d.customers || []))
      .catch(() => {});
  }, []);

  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <AppHeader user={user} />
      <div style={{ padding: '32px 40px', maxWidth: 640, margin: '0 auto' }}>
        <p style={{ fontSize: 13, color: '#8A8A85', margin: '0 0 4px' }}>CODEF 연동 테스트</p>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 6px', color: '#2A2925' }}>
          국세청 증명서 발급 (데모)
        </h1>
        <p style={{ fontSize: 13, color: '#8A8A85', margin: '0 0 24px' }}>
          본인 정보로 직접 테스트해보는 화면입니다. 실제 발급은 각 고객 상세 페이지에서 진행하세요.
        </p>

        <div style={{ background: '#fff', borderRadius: 12, padding: 24 }}>
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
