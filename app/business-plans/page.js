'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/session';
import AppHeader from '../components/AppHeader';

export default function BusinessPlansPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [copyState, setCopyState] = useState({});

  useEffect(() => {
    const session = getSession();
    if (!session) { router.push('/'); return; }
    if (session.role === 'student') { router.push('/menu'); return; }
    setUser(session);

    fetch('/api/business-plans', {
      headers: { 'x-consultant-id': session.username, 'x-consultant-role': session.role },
    })
      .then((r) => r.json())
      .then((d) => setPlans(d.plans || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function copyPlan(plan) {
    try {
      await navigator.clipboard.writeText(plan.content);
      setCopyState((s) => ({ ...s, [plan.id]: '복사됨' }));
      setTimeout(() => setCopyState((s) => ({ ...s, [plan.id]: null })), 2000);
    } catch (err) {
      setCopyState((s) => ({ ...s, [plan.id]: '복사 실패' }));
    }
  }

  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <AppHeader user={user} />
      <div style={{ padding: '32px 40px', maxWidth: 880, margin: '0 auto' }}>
        <p style={{ fontSize: 13, color: '#8A8A85', margin: '0 0 4px' }}>작성 서비스</p>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 6px', color: '#2A2925' }}>사업계획서 보관함</h1>
        <p style={{ fontSize: 14, color: '#8A8A85', margin: '0 0 24px' }}>
          고객 대시보드에서 생성한 사업계획서 초안이 모두 여기 모입니다.
        </p>

        {loading && <p style={{ fontSize: 14, color: '#8A8A85' }}>불러오는 중...</p>}
        {!loading && plans.length === 0 && (
          <p style={{ fontSize: 14, color: '#8A8A85' }}>
            아직 생성한 사업계획서가 없습니다. 고객 대시보드에서 "사업계획서 초안" 버튼을 눌러보세요.
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {plans.map((plan) => {
            const isOpen = openId === plan.id;
            return (
              <div key={plan.id} style={{ background: '#fff', border: '1px solid #E4E2DB', borderRadius: 12, overflow: 'hidden' }}>
                <div
                  onClick={() => setOpenId(isOpen ? null : plan.id)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', cursor: 'pointer' }}
                >
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px', color: '#2A2925' }}>
                      {plan.owner_name || '이름 미입력'} {plan.business_name ? `· ${plan.business_name}` : ''}
                    </p>
                    <p style={{ fontSize: 13, color: '#8A8A85', margin: 0 }}>
                      {plan.fund_name} · {new Date(plan.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); router.push(`/customers/${plan.customer_id}`); }}
                      style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #D3D1C7', background: '#fff', fontSize: 12, cursor: 'pointer' }}
                    >
                      고객으로 이동
                    </button>
                    <span style={{ fontSize: 13, color: '#B0AEA5' }}>{isOpen ? '접기 ▲' : '펼치기 ▼'}</span>
                  </div>
                </div>
                {isOpen && (
                  <div style={{ borderTop: '1px solid #E4E2DB', padding: '16px 20px', background: '#FAF9F6' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                      <button
                        type="button"
                        onClick={() => copyPlan(plan)}
                        style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #D3D1C7', background: copyState[plan.id] === '복사됨' ? '#E6F1FB' : '#fff', fontSize: 12, cursor: 'pointer' }}
                      >
                        {copyState[plan.id] || '전체 복사'}
                      </button>
                    </div>
                    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.7, color: '#2A2925', margin: 0 }}>{plan.content}</pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
