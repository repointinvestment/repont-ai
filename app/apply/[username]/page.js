'use client';

// app/apply/[username]/page.js
// 자가진단 공개 링크 (로드맵 8번). 로그인 없이 누구나 접근 가능한 수강생별(=컨설턴트별) 고유 링크.
// 잠재고객이 간단히 입력하면: ① 해당 컨설턴트 CRM에 리드로 자동 등록 ② 쉬운 말로 요약된 예비 결과를 보여줌.
// 내부 판정 로직(analyzePolicyFunds/buildVerdict)은 그대로 재사용하되, 전문용어(❓ 확인사항, 기관 코드명 등)는
// 노출하지 않고 "검토해볼 만한 지원" 정도의 쉬운 문장으로만 보여줌 — 최종 상담은 담당 컨설턴트가 진행.

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { analyzePolicyFunds } from '@/lib/policyFundAnalysis';
import { buildVerdict } from '@/lib/policyFundVerdict';
import { fetchPolicyFundsData } from '@/lib/policyFundsLookup';

const INDUSTRIES = ['음식점·카페 (요식업)', '도소매업', '제조업', '건설업', '운수업', '서비스업', '정보통신업 (IT)', '기타'];

const input = { width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #E2D9C4', fontSize: 15, boxSizing: 'border-box', background: '#FFFEFB' };
const label = { fontSize: 13, color: '#5F5E5A', display: 'block', marginBottom: 6, fontWeight: 600 };

export default function PublicApplyPage() {
  const params = useParams();
  const [status, setStatus] = useState('checking'); // checking | invalid | form | submitting | done
  const [consultantName, setConsultantName] = useState('');
  const [fundsByKey, setFundsByKey] = useState({});
  const [rulesByKey, setRulesByKey] = useState({});
  const [form, setForm] = useState({ ownerName: '', phone: '', industry: '', businessAgeYears: '', revenueAmount: '', employeeCount: '' });
  const [result, setResult] = useState(null);

  useEffect(() => {
    async function init() {
      try {
        const [cr, fundsData] = await Promise.all([
          fetch(`/api/public/consultant/${params.username}`).then((r) => r.json()),
          fetchPolicyFundsData({ activeOnly: true }),
        ]);
        if (!cr.valid) { setStatus('invalid'); return; }
        setConsultantName(cr.name);
        setFundsByKey(fundsData.fundsByKey);
        setRulesByKey(fundsData.rulesByKey);
        setStatus('form');
      } catch {
        setStatus('invalid');
      }
    }
    init();
  }, [params.username]);

  async function submit(e) {
    e.preventDefault();
    if (!form.ownerName || !form.phone) return;
    setStatus('submitting');

    const salesManwon = Math.round((Number(form.revenueAmount) || 0) * 10000 / 10000); // 억 입력 → 만원 (아래 UI는 억 단위로 받음)
    const analysisForm = {
      industry: form.industry, bizAge: Number(form.businessAgeYears) || 0,
      sales: Math.round((Number(form.revenueAmount) || 0) * 10000), employees: Number(form.employeeCount) || 0,
      creditKCB: 0, creditNICE: 0, sojingongLoans: {}, loans: {}, hasBankruptcy: 'no', currentBizCount: '1',
      smartDevices: [], exportRecord: 'no', salesGrowth: 'no', taxDelinquent: 'no', isFranchise: false, hasPatent: false, careerYears: 0,
    };
    let verdict = null;
    try {
      const analysis = analyzePolicyFunds(analysisForm, fundsByKey, rulesByKey);
      verdict = buildVerdict({ analysis, form: analysisForm, fundsByKey, rulesByKey });
    } catch { /* 결과 계산 실패해도 리드 등록은 진행 */ }
    setResult(verdict);

    try {
      await fetch('/api/public/leads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consultantUsername: params.username, ownerName: form.ownerName, phone: form.phone,
          industry: form.industry, businessAgeYears: analysisForm.bizAge, revenueAmount: analysisForm.sales, employeeCount: analysisForm.employees,
        }),
      });
    } catch { /* 등록 실패해도 화면에는 결과를 보여줌 */ }
    setStatus('done');
  }

  if (status === 'checking') return null;
  if (status === 'invalid') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F5F0' }}>
        <p style={{ fontSize: 15, color: '#8A8A85' }}>유효하지 않은 링크입니다.</p>
      </div>
    );
  }

  const ready = (result?.institutions || []).filter((i) => i.status === '접수 가능');
  const cond = (result?.institutions || []).filter((i) => i.status === '조건부');
  const short = (name) => name.replace(/\s*\(.*?\)\s*/g, '');

  return (
    <div style={{ minHeight: '100vh', background: '#F7F5F0', padding: '40px 16px' }}>
      <div style={{ maxWidth: 460, margin: '0 auto' }}>
        <p style={{ fontSize: 13, color: '#8A8A85', textAlign: 'center', margin: '0 0 4px' }}>정책자금 무료 자가진단</p>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#2A2925', textAlign: 'center', margin: '0 0 4px' }}>{consultantName} 컨설턴트</h1>
        <p style={{ fontSize: 13, color: '#8A8A85', textAlign: 'center', margin: '0 0 28px' }}>1분만 입력하시면 받을 수 있는 정책자금을 바로 확인해드려요.</p>

        {status !== 'done' ? (
          <form onSubmit={submit} style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 8px 24px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <span style={label}>이름 *</span>
              <input style={input} required value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
            </div>
            <div>
              <span style={label}>연락처 *</span>
              <input style={input} required placeholder="010-0000-0000" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <span style={label}>업종</span>
              <select style={input} value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}>
                <option value="">선택</option>
                {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <span style={label}>업력(년)</span>
                <input style={input} type="number" value={form.businessAgeYears} onChange={(e) => setForm({ ...form, businessAgeYears: e.target.value })} />
              </div>
              <div>
                <span style={label}>직원 수</span>
                <input style={input} type="number" value={form.employeeCount} onChange={(e) => setForm({ ...form, employeeCount: e.target.value })} />
              </div>
            </div>
            <div>
              <span style={label}>연매출 (억원)</span>
              <input style={input} type="number" step="0.1" placeholder="예: 3.5" value={form.revenueAmount} onChange={(e) => setForm({ ...form, revenueAmount: e.target.value })} />
            </div>
            <button type="submit" disabled={status === 'submitting'} style={{ padding: '14px', borderRadius: 10, border: 'none', background: '#2A2925', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              {status === 'submitting' ? '확인 중…' : '결과 확인하기'}
            </button>
            <p style={{ fontSize: 11, color: '#B0AEA5', margin: 0, textAlign: 'center' }}>입력하신 정보는 담당 컨설턴트에게 전달되어 상담에 활용됩니다.</p>
          </form>
        ) : (
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#2A2925', margin: '0 0 14px' }}>{form.ownerName}님, 확인해봤어요</p>
            {ready.length > 0 ? (
              <div style={{ background: '#E1F5EE', borderRadius: 12, padding: '14px 16px', marginBottom: 10 }}>
                <p style={{ fontSize: 12.5, fontWeight: 700, color: '#085041', margin: '0 0 6px' }}>검토해볼 만한 지원</p>
                {ready.map((i, k) => <p key={k} style={{ fontSize: 13.5, color: '#2A2925', margin: '3px 0' }}>• {short(i.name)}</p>)}
              </div>
            ) : cond.length > 0 ? (
              <div style={{ background: '#FAEEDA', borderRadius: 12, padding: '14px 16px', marginBottom: 10 }}>
                <p style={{ fontSize: 12.5, fontWeight: 700, color: '#633806', margin: '0 0 6px' }}>조건 확인이 필요한 지원</p>
                {cond.map((i, k) => <p key={k} style={{ fontSize: 13.5, color: '#2A2925', margin: '3px 0' }}>• {short(i.name)}</p>)}
              </div>
            ) : (
              <p style={{ fontSize: 13.5, color: '#5F5E5A' }}>입력하신 조건으로는 자동으로 판단하기 어려운 부분이 있어요. 상담을 통해 정확히 확인해드릴게요.</p>
            )}
            <p style={{ fontSize: 13, color: '#5F5E5A', lineHeight: 1.7, marginTop: 14 }}>
              정확한 한도와 신청 절차는 실제 서류 확인 후 결정됩니다. <strong>{consultantName}</strong> 컨설턴트가 입력하신 연락처로 곧 연락드릴게요.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
