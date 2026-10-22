'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/session';
import AppHeader from '../components/AppHeader';
import PlanDocument from '../components/PlanDocument';

export default function BusinessPlansPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [copyState, setCopyState] = useState({});
  const [scope, setScope] = useState('mine'); // 관리자만 'all' 선택 가능 — 기본은 내 고객의 계획서만

  useEffect(() => {
    const session = getSession();
    if (!session) { router.push('/'); return; }
    setUser(session);

    setLoading(true);
    fetch(scope === 'all' && session.role === 'admin' ? '/api/business-plans?scope=all' : '/api/business-plans', {
      headers: { 'x-consultant-id': session.username, 'x-consultant-role': session.role },
    })
      .then((r) => r.json())
      .then((d) => setPlans(d.plans || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [scope]);

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
    <div style={{ minHeight: '100vh', background: '#F7F5F0' }}>
      <AppHeader user={user} />
      <div style={{ padding: '32px 40px', maxWidth: 880, margin: '0 auto' }}>
        <p style={{ fontSize: 13, color: '#8A8A85', margin: '0 0 4px' }}>작성 서비스</p>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 6px', color: '#2A2925' }}>사업계획서 보관함</h1>
        <p style={{ fontSize: 14, color: '#8A8A85', margin: '0 0 12px' }}>
          고객 대시보드에서 생성한 사업계획서가 모두 여기 모입니다.
        </p>
        {user.role === 'admin' && (
          <div style={{ display: 'inline-flex', border: '1px solid #D9D3C4', borderRadius: 999, overflow: 'hidden', marginBottom: 20 }}>
            {[['mine', '내 고객'], ['all', '전체 컨설턴트 (관리자)']].map(([k, label]) => (
              <button key={k} type="button" onClick={() => setScope(k)}
                style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: scope === k ? '#0B2440' : '#fff', color: scope === k ? '#E9C979' : '#5F5E5A' }}>
                {label}
              </button>
            ))}
          </div>
        )}

        {loading && <p style={{ fontSize: 14, color: '#8A8A85' }}>불러오는 중...</p>}
        {!loading && plans.length === 0 && (
          <p style={{ fontSize: 14, color: '#8A8A85' }}>
            아직 생성한 사업계획서가 없습니다. 고객 대시보드에서 "사업계획서" 버튼을 눌러보세요.
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
                      {scope === 'all' && plan.consultant_id ? ` · 담당 ${plan.consultant_name || plan.consultant_id}` : ''}
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
                  <div style={{ borderTop: '1px solid #E4E2DB', padding: '18px 20px 22px', background: '#EFEDE6' }}>
                    <PlanDocument content={plan.content} fundName={plan.fund_name} ownerName={plan.owner_name} businessName={plan.business_name} createdAt={plan.created_at} author={user.name} />
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
