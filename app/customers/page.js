'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSession } from '@/lib/session';
import AppHeader from '../components/AppHeader';

const STAGE_STYLE = {
  '상담중': { bg: '#FAECE7', text: '#712B13', ring: '#D85A30' },
  '서류준비': { bg: '#FAEEDA', text: '#633806', ring: '#BA7517' },
  '심사중': { bg: '#E1F5EE', text: '#085041', ring: '#0F6E56' },
  '완료': { bg: '#E6F1FB', text: '#0C447C', ring: '#185FA5' },
};

function CustomersPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const consultantFilter = searchParams.get('consultant'); // admin이 특정 컨설턴트의 고객만 보고 싶을 때(?consultant=아이디)
  const [user, setUser] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const session = getSession();
    if (!session) { router.push('/'); return; }
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
  const visibleCustomers = consultantFilter ? customers.filter((c) => String(c.consultant_id) === String(consultantFilter)) : customers;

  const stageCounts = visibleCustomers.reduce((acc, c) => {
    const stage = normalizeStage(c.status);
    acc[stage] = (acc[stage] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
    <AppHeader user={user} />
    <div style={{ padding: '32px 40px', maxWidth: 960, margin: '0 auto' }}>

      {consultantFilter && (
        <div style={{ background: '#FFF6F2', border: '1px solid #F0D9CC', borderRadius: 10, padding: '10px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#B24A2B' }}>👁 관리자 보기 — <strong>{consultantFilter}</strong> 님 담당 고객만 보고 있습니다</span>
          <button onClick={() => router.push('/customers')} style={{ fontSize: 12, color: '#B24A2B', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}>전체 보기</button>
        </div>
      )}

      {/* 개인화된 히어로 배너 */}
      <div style={{
        background: 'linear-gradient(135deg, #FAECE7 0%, #F7F5F0 60%)',
        borderRadius: 16, padding: '28px 32px', marginBottom: 24,
        display: 'flex', alignItems: 'center', gap: 20,
        border: '1px solid #EEE6DA',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', background: '#D85A30',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, fontWeight: 700, flexShrink: 0,
        }}>
          {user.name ? user.name.slice(0, 2) : '담당'}
        </div>
        <div>
          <p style={{ fontSize: 12, color: '#8A5A2E', margin: '0 0 4px', letterSpacing: '0.02em' }}>
            {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })} · 실시간 갱신
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 6px', color: '#2A2925' }}>
            {consultantFilter ? `${consultantFilter}님의 고객명단` : `${user.name} 컨설턴트님의 고객명단`}
          </h1>
          <p style={{ fontSize: 14, color: '#5F5E5A', margin: 0 }}>
            이번 달 신규 상담 {visibleCustomers.length}건 · 아래에서 고객 상세와 계정정보까지 바로 확인하세요
          </p>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 13, color: '#5F5E5A', margin: '0 0 12px', fontWeight: 600 }}>단계별 고객 현황</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {Object.entries(STAGE_STYLE).map(([stage, style]) => (
            <div key={stage} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: '#fff', borderRadius: 12, padding: '16px 18px',
              border: '1px solid #E4E2DB', boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            }}>
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
                  fontWeight: 700,
                  fontSize: 15,
                  flexShrink: 0,
                }}
              >
                {stageCounts[stage] || 0}
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: '#2A2925' }}>{stage}</p>
                <p style={{ fontSize: 12, color: '#8A8A85', margin: 0 }}>
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
      {!loading && !error && visibleCustomers.length === 0 && (
        <p style={{ fontSize: 14, color: '#8A8A85' }}>등록된 고객이 없습니다.</p>
      )}

      {Object.keys(STAGE_STYLE).map((stage) => {
        const stageCustomers = visibleCustomers.filter((c) => normalizeStage(c.status) === stage);
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

export default function CustomersPage() {
  return (
    <Suspense fallback={null}>
      <CustomersPageInner />
    </Suspense>
  );
}
