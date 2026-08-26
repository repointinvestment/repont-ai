'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/session';
import AppHeader from '../components/AppHeader';

const STAGE_STYLE = {
  '상담중': { bg: '#FAECE7', text: '#712B13', ring: '#D85A30' },
  '서류준비': { bg: '#FAEEDA', text: '#633806', ring: '#BA7517' },
  '심사중': { bg: '#E1F5EE', text: '#085041', ring: '#0F6E56' },
  '완료': { bg: '#E6F1FB', text: '#0C447C', ring: '#185FA5' },
};

export default function CustomersPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const session = getSession();
    if (!session) { router.push('/'); return; }
    if (session.role === 'student') { router.push('/menu'); return; } // 수강생은 CRM 접근 불가
    setUser(session);

    async function loadCustomers() {
      try {
        const res = await fetch('/api/customers', {
          headers: {
            'x-consultant-id': session.username,
            'x-consultant-role': session.role,
          },
        });
        const data = await res.json();
        setCustomers(data.customers || []);
      } catch (err) {
        setError('고객 목록을 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    }
    loadCustomers();
  }, []);

  if (!user) return null;

  const normalizeStage = (status) => (STAGE_STYLE[status] ? status : '상담중');

  const stageCounts = customers.reduce((acc, c) => {
    const stage = normalizeStage(c.status);
    acc[stage] = (acc[stage] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
    <AppHeader user={user} />
    <div style={{ padding: '32px 40px', maxWidth: 960, margin: '0 auto' }}>
      <p style={{ fontSize: 13, color: '#8A8A85', margin: '0 0 4px' }}>
        오늘 기준 실시간 갱신
      </p>
      <h1 style={{ fontSize: 26, fontWeight: 500, lineHeight: 1.4, margin: '0 0 8px', maxWidth: 520 }}>
        이번 달 신규 상담 {customers.length}건이에요.
      </h1>
      <p style={{ fontSize: 14, color: '#5F5E5A', lineHeight: 1.6, margin: '0 0 24px', maxWidth: 560 }}>
        담당 컨설턴트별 진행 현황을 정리했습니다. 아래에서 고객 상세와 계정정보까지 바로 확인하세요.
      </p>

      <div style={{ background: '#F7F5F0', borderRadius: 12, padding: '20px', marginBottom: 24 }}>
        <p style={{ fontSize: 13, color: '#5F5E5A', margin: '0 0 16px' }}>단계별 고객 현황</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
          {Object.entries(STAGE_STYLE).map(([stage, style]) => (
            <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: style.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: style.text,
                  fontWeight: 500,
                  fontSize: 14,
                }}
              >
                {stageCounts[stage] || 0}
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>{stage}</p>
                <p style={{ fontSize: 13, color: '#8A8A85', margin: 0 }}>
                  {stageCounts[stage] || 0}명
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <p style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>고객 목록</p>
        <button
          onClick={() => router.push('/customers/new')}
          style={{
            fontSize: 13,
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid #D3D1C7',
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          신규 등록
        </button>
      </div>

      {loading && <p style={{ fontSize: 14, color: '#8A8A85' }}>불러오는 중...</p>}
      {error && <p style={{ fontSize: 14, color: '#A32D2D' }}>{error}</p>}
      {!loading && !error && customers.length === 0 && (
        <p style={{ fontSize: 14, color: '#8A8A85' }}>등록된 고객이 없습니다.</p>
      )}

      {Object.keys(STAGE_STYLE).map((stage) => {
        const stageCustomers = customers.filter((c) => normalizeStage(c.status) === stage);
        const style = STAGE_STYLE[stage];
        return (
          <div key={stage} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: style.ring }} />
              <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: '#2A2925' }}>{stage}</p>
              <span style={{ fontSize: 13, color: '#8A8A85' }}>{stageCustomers.length}명</span>
            </div>
            {stageCustomers.length === 0 ? (
              <p style={{ fontSize: 13, color: '#B0AEA5', margin: 0 }}>해당 고객이 없습니다.</p>
            ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {stageCustomers.map((c) => (
                <div
                  key={c.id}
                  onClick={() => router.push(`/customers/${c.id}`)}
                  style={{
                    cursor: 'pointer',
                    background: '#fff',
                    border: '1px solid #E4E2DB',
                    borderRadius: 12,
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: style.bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 500,
                        fontSize: 13,
                        color: style.text,
                      }}
                    >
                      {c.owner_name ? c.owner_name.slice(0, 2) : '고객'}
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>
                        {c.owner_name || '이름 미입력'} {c.business_name ? `· ${c.business_name}` : ''}
                      </p>
                      <p style={{ fontSize: 13, color: '#8A8A85', margin: 0 }}>
                        {c.industry || ''}
                        {c.first_consulted_at ? ` · 최초 상담 ${new Date(c.first_consulted_at).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })}` : ''}
                      </p>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      padding: '4px 10px',
                      borderRadius: 8,
                      background: style.bg,
                      color: style.text,
                    }}
                  >
                    {stage}
                  </span>
                </div>
              ))}
            </div>
            )}
          </div>
        );
      })}
    </div>
    </div>
  );
}
