'use client';

// app/customers/[id]/report/page.js
// 상담 결과 리포트 (로드맵 4번). 전화 상담 고객에게 보여주거나, 대면 후 카톡으로 정리해서 보내는 용도.
// 브라우저 인쇄(Ctrl/Cmd+P) → PDF로 저장 방식. 작성한 컨설턴트(수강생) 이름이 박혀서 누가 만들었는지 남음.

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getSession } from '@/lib/session';
import { analyzePolicyFunds } from '@/lib/policyFundAnalysis';
import { buildVerdict } from '@/lib/policyFundVerdict';
import { fetchPolicyFundsData } from '@/lib/policyFundsLookup';

const fmtWon = (v) => (v == null ? '-' : v >= 10000 ? `${(v / 10000).toLocaleString()}억` : `${v.toLocaleString()}만원`);

export default function ConsultationReportPage() {
  const router = useRouter();
  const params = useParams();
  const [user, setUser] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [fundsByKey, setFundsByKey] = useState({});
  const [rulesByKey, setRulesByKey] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s = getSession();
    if (!s) { router.push('/'); return; }
    setUser(s);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const [cr, fundsData] = await Promise.all([
          fetch(`/api/customers/${params.id}`).then((r) => r.json()),
          fetchPolicyFundsData({ activeOnly: true }),
        ]);
        setCustomer(cr.customer);
        setFundsByKey(fundsData.fundsByKey);
        setRulesByKey(fundsData.rulesByKey);
      } finally { setLoading(false); }
    }
    load();
  }, [params.id]);

  if (!user || loading) return null;
  if (!customer) return <div style={{ padding: 40 }}>고객 정보를 찾을 수 없습니다.</div>;

  const pfd = customer.policy_fund_details || {};
  const hasDetailedData = customer.business_age_years !== null && customer.business_age_years !== undefined;
  const analysisForm = {
    industry: customer.industry, bizAge: customer.business_age_years, sales: customer.revenue_amount,
    employees: customer.employee_count, creditKCB: customer.credit_kcb, creditNICE: customer.credit_nice,
    sojingongLoans: pfd.sojingongLoans, loans: pfd.loans, hasBankruptcy: pfd.hasBankruptcy,
    currentBizCount: pfd.currentBizCount, smartDevices: pfd.smartDevices, exportRecord: pfd.exportRecord,
    salesGrowth: pfd.salesGrowth, taxDelinquent: pfd.taxDelinquent, isFranchise: pfd.isFranchise,
    hasPatent: customer.has_patent, careerYears: customer.owner_career_years,
  };
  const analysis = hasDetailedData ? analyzePolicyFunds(analysisForm, fundsByKey, rulesByKey) : null;
  const verdict = analysis ? buildVerdict({ analysis, form: analysisForm, fundsByKey, rulesByKey }) : null;

  // 필요서류: "접수 가능/조건부"로 뜬 자금들을 이름으로 마스터 DB와 매칭해 required_docs 합집합
  const candidateFundNames = new Set();
  (verdict?.institutions || []).forEach((i) => (i.funds || []).forEach((f) => candidateFundNames.add(f.name)));
  const requiredDocs = new Set();
  Object.values(fundsByKey).forEach((f) => {
    if (candidateFundNames.has(f.name)) (f.required_docs || []).forEach((d) => requiredDocs.add(d));
  });

  const readyInstitutions = (verdict?.institutions || []).filter((i) => i.status === '접수 가능');
  const condInstitutions = (verdict?.institutions || []).filter((i) => i.status === '조건부');
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

  const h2 = { fontSize: 15, fontWeight: 700, color: '#1a1a2e', margin: '22px 0 10px', borderBottom: '2px solid #2A2925', paddingBottom: 6 };
  const p = { fontSize: 13, lineHeight: 1.7, color: '#2A2925', margin: '4px 0' };

  return (
    <div style={{ background: '#F0EFEA', minHeight: '100vh' }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .report-page { box-shadow: none !important; margin: 0 !important; }
          body { background: #fff !important; }
        }
      `}</style>

      <div className="no-print" style={{ position: 'sticky', top: 0, background: '#2A2925', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
        <button onClick={() => router.push(`/customers/${params.id}`)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 13, cursor: 'pointer' }}>← 고객 상세로</button>
        <button onClick={() => window.print()} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#fff', color: '#2A2925', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>🖨 인쇄 / PDF로 저장</button>
      </div>

      <div className="report-page" style={{ maxWidth: 720, margin: '24px auto', background: '#fff', padding: '48px 56px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <p style={{ fontSize: 11, color: '#8A8A85', margin: 0 }}>자금비서 · 정책자금 상담 결과 리포트</p>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1a1a2e', margin: '4px 0 0' }}>{customer.owner_name || '고객'}{customer.business_name ? ` (${customer.business_name})` : ''}</h1>
          </div>
          <div style={{ textAlign: 'right', fontSize: 12, color: '#5F5E5A' }}>
            <div>작성일: {today}</div>
            <div>담당 컨설턴트: <strong>{user.name}</strong></div>
          </div>
        </div>
        <p style={{ fontSize: 12.5, color: '#5F5E5A', margin: '8px 0 0' }}>
          {customer.industry || '업종 미입력'} · 업력 {customer.business_age_years ?? '-'}년 · 연매출 {fmtWon(customer.revenue_amount)} · 직원 {customer.employee_count ?? '-'}명
        </p>

        {!hasDetailedData ? (
          <p style={{ ...p, marginTop: 20, color: '#B0AEA5' }}>* 아직 상세 진단 정보가 입력되지 않아 정밀 판정을 표시할 수 없습니다. 고객 정보 수정에서 자금진단 정보를 입력해주세요.</p>
        ) : (
          <>
            <p style={h2}>1. 진단 결과 요약</p>
            {readyInstitutions.length > 0 ? (
              <>
                <p style={p}><strong>지금 접수 가능한 기관:</strong> {readyInstitutions.map((i) => i.name.replace(/\s*\(.*?\)/, '')).join(', ')}</p>
                {readyInstitutions.map((i) => (
                  <div key={i.key} style={{ margin: '6px 0 6px 14px' }}>
                    {(i.funds || []).filter((f) => !f.status || f.status === '가능').map((f, idx) => (
                      <p key={idx} style={{ ...p, margin: '2px 0' }}>· {f.name} — {f.limit} {f.rate ? `(${f.rate})` : ''}</p>
                    ))}
                  </div>
                ))}
              </>
            ) : (
              <p style={p}>현재 조건으로 바로 접수 가능한 기관은 없습니다. 아래 조건부 항목을 확인하세요.</p>
            )}
            {condInstitutions.length > 0 && (
              <>
                <p style={{ ...p, marginTop: 10 }}><strong>조건 확인 후 접수 가능:</strong></p>
                {condInstitutions.map((i) => (
                  <p key={i.key} style={{ ...p, margin: '2px 0 2px 14px' }}>· {i.name.replace(/\s*\(.*?\)/, '')} — {i.reasons?.[0]}</p>
                ))}
              </>
            )}

            <p style={h2}>2. 최종 결정 4요소</p>
            {verdict && ['debt', 'sales', 'financial', 'credit'].map((k) => {
              const f = verdict.factors[k];
              if (!f) return null;
              return <p key={k} style={p}><strong>{f.label}:</strong> {f.value} — {f.assessment}</p>;
            })}

            <p style={h2}>3. 필요 서류</p>
            {requiredDocs.size > 0 ? (
              <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                {[...requiredDocs].map((d, i) => <li key={i} style={p}>{d}</li>)}
              </ul>
            ) : <p style={p}>확정된 접수 대상 자금이 없어 서류 목록을 특정하기 어렵습니다. 상담 후 다시 생성해주세요.</p>}

            <p style={h2}>4. 예상 진행 순서</p>
            <ol style={{ margin: '4px 0', paddingLeft: 20 }}>
              {readyInstitutions.some((i) => i.key === 'sojinkong') && <li style={p}>소진공 직접대출 접수 (심사 결과 나올 때까지 1개만 진행)</li>}
              {readyInstitutions.some((i) => ['jaedan', 'shinbo', 'gibo'].includes(i.key)) && (
                <>
                  <li style={p}>보증기관(재단/신보/기보 중 1곳) 접수</li>
                  <li style={p}>보증서 수령 후 대기</li>
                </>
              )}
              {readyInstitutions.some((i) => i.key === 'sojinkong') && <li style={p}>소진공 심사 완료 후 약정·입금</li>}
              {readyInstitutions.some((i) => ['jaedan', 'shinbo', 'gibo'].includes(i.key)) && <li style={p}>보증서 지참 후 은행 방문하여 보증대출 실행</li>}
              {readyInstitutions.length === 0 && <li style={p}>조건부 항목 확인 → 서류 준비 → 접수</li>}
            </ol>

            <p style={{ fontSize: 11, color: '#B0AEA5', marginTop: 24 }}>
              * 본 리포트는 등록된 정보를 바탕으로 한 예비 분석이며, 최종 승인 여부와 한도는 각 기관 심사에 따라 달라질 수 있습니다.
            </p>
          </>
        )}

        <div style={{ marginTop: 40, paddingTop: 16, borderTop: '1px solid #E0DFDA', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8A8A85' }}>
          <span>리포인트파트너스 · 자금비서</span>
          <span>작성: {user.name} 컨설턴트</span>
        </div>
      </div>
    </div>
  );
}
