'use client';

// app/apply/[username]/page.js
// 자가진단 공개 링크. 로그인 없이 접근 가능. 두 가지 유입 경로를 하나의 페이지에서 처리:
//   1) 콜드 유입(SNS·블로그 공유 링크, /apply/아이디) — 이름·업력·매출 등을 직접 입력받는 기존 폼 흐름
//   2) 웜 유입(머니콕 카톡 "문의하기", /apply/아이디?t=토큰) — 이미 CRM에 저장된 정보가 있는 고객이라
//      다시 입력받지 않고 토큰으로 저장된 정보를 그대로 불러와 즉시 결과를 보여줌(귀찮아할 걸 감안).
// 브랜딩: "머니콕"은 고객이 보는 대외용 브랜드 — "자금비서"는 컨설턴트 전용 내부 툴이라 여기 안 나옴.
// 사진을 올린 컨설턴트는 "머니콕" 대신 본인 사진+이름이 먼저 보이도록 개인화됨(내 프로필 기능).

import { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { analyzePolicyFunds } from '@/lib/policyFundAnalysis';
import { buildVerdict } from '@/lib/policyFundVerdict';
import { fetchPolicyFundsData } from '@/lib/policyFundsLookup';

const INDUSTRIES = ['음식점·카페 (요식업)', '도소매업', '제조업', '건설업', '운수업', '서비스업', '정보통신업 (IT)', '기타'];

const INK = '#17261F';
const ACCENT = '#2F6E51';
const ACCENT_DEEP = '#1F4E39';
const ACCENT_SOFT = '#E3EFE6';
const GOLD = '#B9862F';
const GOLD_SOFT = '#F6EEDD';
const PAPER = '#FBF8F2';
const LINE = '#E4E0D3';

function GrowthIllustration({ size = 156 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="80" cy="80" r="78" fill={ACCENT_SOFT} />
      <rect x="36" y="96" width="16" height="34" rx="3" fill={ACCENT} opacity="0.55" />
      <rect x="58" y="80" width="16" height="50" rx="3" fill={ACCENT} opacity="0.75" />
      <rect x="80" y="60" width="16" height="70" rx="3" fill={ACCENT} />
      <path d="M40 92 L66 72 L88 54 L120 34" stroke={GOLD} strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M108 34 L120 34 L120 46" stroke={GOLD} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="120" cy="34" r="15" fill={GOLD} />
      <text x="120" y="39.5" textAnchor="middle" fontSize="15" fontWeight="700" fill="#fff" fontFamily="'Noto Sans KR', sans-serif">₩</text>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="10" fill={ACCENT} />
      <path d="M5.8 10.2L8.4 12.8L14.2 7" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const FEATURES = [
  { label: '1분이면 충분해요', detail: '업종·업력·매출만 입력' },
  { label: '전문 컨설턴트가 검토해요', detail: '자동 결과 + 사람의 확인' },
  { label: '완전 무료예요', detail: '가입도, 비용도 없어요' },
];

const input = {
  width: '100%', padding: '13px 15px', borderRadius: 10, border: `1.5px solid ${LINE}`,
  fontSize: 15, boxSizing: 'border-box', background: '#fff', color: INK, fontFamily: "'Noto Sans KR', sans-serif",
};
const label = { fontSize: 13, color: '#5C6B62', display: 'block', marginBottom: 6, fontWeight: 600 };

// snapshot(customer-snapshot API 응답) → analyzePolicyFunds 입력 형태로 변환. 고객 대시보드와 같은 매핑.
function snapshotToAnalysisForm(c) {
  const pfd = c.policy_fund_details || {};
  return {
    industry: c.industry, bizAge: c.business_age_years, sales: c.revenue_amount, employees: c.employee_count,
    creditKCB: c.credit_kcb, creditNICE: c.credit_nice, sojingongLoans: pfd.sojingongLoans, loans: pfd.loans,
    hasBankruptcy: pfd.hasBankruptcy, currentBizCount: pfd.currentBizCount, smartDevices: pfd.smartDevices,
    exportRecord: pfd.exportRecord, salesGrowth: pfd.salesGrowth, taxDelinquent: pfd.taxDelinquent,
    isFranchise: pfd.isFranchise, hasPatent: c.has_patent, careerYears: c.owner_career_years,
  };
}

function PublicApplyPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = searchParams.get('t');

  const [status, setStatus] = useState('checking'); // checking | invalid | form | submitting | done
  const [consultantName, setConsultantName] = useState('');
  const [consultantPhoto, setConsultantPhoto] = useState('');
  const [consultantIntro, setConsultantIntro] = useState('');
  const [fundsByKey, setFundsByKey] = useState({});
  const [rulesByKey, setRulesByKey] = useState({});
  const [form, setForm] = useState({ ownerName: '', phone: '', industry: '', businessAgeYears: '', revenueAmount: '', employeeCount: '' });
  const [result, setResult] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [returningName, setReturningName] = useState(''); // 토큰 흐름일 때 인사말에 쓸 저장된 이름
  const [inquireState, setInquireState] = useState('idle'); // idle | sending | done

  useEffect(() => {
    async function init() {
      try {
        const [cr, fundsData, profileData] = await Promise.all([
          fetch(`/api/public/consultant/${params.username}`).then((r) => r.json()),
          fetchPolicyFundsData({ activeOnly: true }),
          fetch(`/api/consultant/profile?username=${params.username}`).then((r) => r.json()).catch(() => ({})),
        ]);
        if (!cr.valid) { setStatus('invalid'); return; }
        setConsultantName(cr.name);
        setConsultantPhoto(profileData?.profile?.profile_photo_url || '');
        setConsultantIntro(profileData?.profile?.profile_intro || '');
        setFundsByKey(fundsData.fundsByKey);
        setRulesByKey(fundsData.rulesByKey);

        if (token) {
          // 웜 유입 — 저장된 정보로 폼 없이 바로 결과 계산
          const snap = await fetch(`/api/public/customer-snapshot?t=${token}`).then((r) => r.json());
          if (snap.customer) {
            setReturningName(snap.customer.owner_name || '');
            const analysisForm = snapshotToAnalysisForm(snap.customer);
            try {
              const analysis = analyzePolicyFunds(analysisForm, fundsData.fundsByKey, fundsData.rulesByKey);
              setResult(buildVerdict({ analysis, form: analysisForm, fundsByKey: fundsData.fundsByKey, rulesByKey: fundsData.rulesByKey }));
            } catch { /* 계산 실패해도 화면은 정상 표시 */ }
            setStatus('done');
            requestAnimationFrame(() => setMounted(true));
            return;
          }
          // 토큰이 유효하지 않으면 일반 폼으로 폴백
        }
        setStatus('form');
        requestAnimationFrame(() => setMounted(true));
      } catch {
        setStatus('invalid');
      }
    }
    init();
  }, [params.username, token]);

  async function submit(e) {
    e.preventDefault();
    if (!form.ownerName || !form.phone) return;
    setStatus('submitting');

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

  async function requestConsult() {
    setInquireState('sending');
    try {
      await fetch('/api/public/customer-snapshot/inquire', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
      });
    } catch { /* 실패해도 사용자한텐 완료로 보여줌 — 재시도 유도보다 혼란 방지 우선 */ }
    setInquireState('done');
  }

  if (status === 'checking') return <div style={{ minHeight: '100vh', background: PAPER }} />;
  if (status === 'invalid') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: PAPER, fontFamily: "'Noto Sans KR', sans-serif" }}>
        <p style={{ fontSize: 15, color: '#8A8A85' }}>유효하지 않은 링크입니다.</p>
      </div>
    );
  }

  const ready = (result?.institutions || []).filter((i) => i.status === '접수 가능');
  const cond = (result?.institutions || []).filter((i) => i.status === '조건부');
  const short = (name) => name.replace(/\s*\(.*?\)\s*/g, '');
  const isReturning = !!token && !!returningName;
  const greetingName = isReturning ? returningName : form.ownerName;

  return (
    <div style={{ minHeight: '100vh', background: PAPER, fontFamily: "'Noto Sans KR', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@700;900&family=Noto+Sans+KR:wght@400;500;600;700&display=swap');
        .apply-hero { opacity: 0; transform: translateY(10px); transition: opacity .6s ease, transform .6s ease; }
        .apply-hero.in { opacity: 1; transform: translateY(0); }
        .apply-input:focus { outline: none; border-color: ${ACCENT} !important; box-shadow: 0 0 0 3px ${ACCENT_SOFT}; }
      `}</style>

      <div style={{ maxWidth: 460, margin: '0 auto', padding: '52px 20px 60px' }}>
        {/* 히어로 */}
        <div className={`apply-hero${mounted ? ' in' : ''}`} style={{ textAlign: 'center', marginBottom: 30 }}>
          <p style={{ fontFamily: "'Noto Serif KR', serif", fontWeight: 900, fontSize: 15, letterSpacing: '0.04em', color: ACCENT_DEEP, margin: '0 0 10px' }}>
            머니콕
          </p>
          {!isReturning && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 13px', borderRadius: 999, background: GOLD_SOFT, marginBottom: 20 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: GOLD }}>무료 · 1분 · 가입 없이</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
            <GrowthIllustration />
          </div>
          <h1 style={{
            fontFamily: "'Noto Serif KR', serif", fontWeight: 900, color: INK,
            fontSize: 'clamp(26px, 7vw, 32px)', lineHeight: 1.35, margin: '0 0 12px', letterSpacing: '-0.01em',
          }}>
            {isReturning ? <>{greetingName}님, 다시<br />확인해봤어요</> : <>내가 받을 수 있는<br />정책자금, 지금 확인하세요</>}
          </h1>
          <p style={{ fontSize: 14, color: '#5C6B62', margin: 0, lineHeight: 1.6 }}>
            {isReturning ? '전에 남겨주신 정보로 다시 계산했어요' : '전문 컨설턴트가 직접 검토해드려요'}
          </p>
          {consultantPhoto && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginTop: 18, padding: '10px 16px 10px 10px', background: '#fff', borderRadius: 999, border: `1px solid ${LINE}` }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: `url(${consultantPhoto}) center/cover`, flexShrink: 0, border: `1.5px solid ${ACCENT_SOFT}` }} />
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: INK, margin: 0 }}>{consultantName} 담당자</p>
                {consultantIntro && <p style={{ fontSize: 11.5, color: '#8A9188', margin: '2px 0 0' }}>{consultantIntro}</p>}
              </div>
            </div>
          )}
        </div>

        {/* 신뢰 요소 3개 — 폼을 채울 때만 (재방문 흐름은 입력이 없으니 생략) */}
        {status !== 'done' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {FEATURES.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 12, padding: '13px 16px', border: `1px solid ${LINE}` }}>
                <CheckIcon />
                <div>
                  <p style={{ fontSize: 13.5, fontWeight: 700, color: INK, margin: 0 }}>{f.label}</p>
                  <p style={{ fontSize: 12, color: '#8A9188', margin: '2px 0 0' }}>{f.detail}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {status !== 'done' ? (
          <form onSubmit={submit} style={{ background: '#fff', borderRadius: '22px 22px 18px 18px', padding: 26, boxShadow: '0 12px 32px rgba(23,38,31,0.08)', display: 'flex', flexDirection: 'column', gap: 17, border: `1px solid ${LINE}` }}>
            <div>
              <span style={label}>이름 *</span>
              <input className="apply-input" style={input} required value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
            </div>
            <div>
              <span style={label}>연락처 *</span>
              <input className="apply-input" style={input} required placeholder="010-0000-0000" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <span style={label}>업종</span>
              <select className="apply-input" style={input} value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}>
                <option value="">선택</option>
                {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <span style={label}>업력(년)</span>
                <input className="apply-input" style={input} type="number" value={form.businessAgeYears} onChange={(e) => setForm({ ...form, businessAgeYears: e.target.value })} />
              </div>
              <div>
                <span style={label}>직원 수</span>
                <input className="apply-input" style={input} type="number" value={form.employeeCount} onChange={(e) => setForm({ ...form, employeeCount: e.target.value })} />
              </div>
            </div>
            <div>
              <span style={label}>연매출 (억원)</span>
              <input className="apply-input" style={input} type="number" step="0.1" placeholder="예: 3.5" value={form.revenueAmount} onChange={(e) => setForm({ ...form, revenueAmount: e.target.value })} />
            </div>
            <button type="submit" disabled={status === 'submitting'} style={{
              padding: '16px', borderRadius: 12, border: 'none', background: ACCENT_DEEP, color: '#fff',
              fontSize: 16, fontWeight: 700, cursor: 'pointer', marginTop: 4, letterSpacing: '-0.01em',
              boxShadow: `0 8px 20px rgba(31,78,57,0.28)`,
            }}>
              {status === 'submitting' ? '확인 중…' : '내 자금 확인하기'}
            </button>
            <p style={{ fontSize: 11, color: '#A8AFA5', margin: 0, textAlign: 'center' }}>입력하신 정보는 담당 컨설턴트에게 전달되어 상담에 활용됩니다.</p>
          </form>
        ) : (
          <div style={{ background: '#fff', borderRadius: '22px 22px 18px 18px', padding: 26, boxShadow: '0 12px 32px rgba(23,38,31,0.08)', border: `1px solid ${LINE}` }}>
            <p style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 19, fontWeight: 700, color: INK, margin: '0 0 16px' }}>{greetingName}님, 확인해봤어요</p>
            {ready.length > 0 ? (
              <div style={{ background: ACCENT_SOFT, borderRadius: 14, padding: '17px 18px', marginBottom: 10 }}>
                <p style={{ fontSize: 12.5, fontWeight: 700, color: ACCENT_DEEP, margin: '0 0 8px' }}>검토해볼 만한 지원</p>
                {ready.map((i, k) => (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '5px 0' }}>
                    <CheckIcon />
                    <span style={{ fontSize: 14, color: INK, fontWeight: 600 }}>{short(i.name)}</span>
                  </div>
                ))}
              </div>
            ) : cond.length > 0 ? (
              <div style={{ background: GOLD_SOFT, borderRadius: 14, padding: '17px 18px', marginBottom: 10 }}>
                <p style={{ fontSize: 12.5, fontWeight: 700, color: GOLD, margin: '0 0 8px' }}>조건 확인이 필요한 지원</p>
                {cond.map((i, k) => <p key={k} style={{ fontSize: 14, color: INK, margin: '5px 0', fontWeight: 600 }}>{short(i.name)}</p>)}
              </div>
            ) : (
              <p style={{ fontSize: 13.5, color: '#5C6B62' }}>입력하신 조건으로는 자동으로 판단하기 어려운 부분이 있어요. 상담을 통해 정확히 확인해드릴게요.</p>
            )}

            {isReturning ? (
              <>
                <p style={{ fontSize: 13, color: '#5C6B62', lineHeight: 1.7, marginTop: 16, marginBottom: 14 }}>
                  정확한 한도와 신청 절차는 실제 서류 확인 후 결정됩니다.
                </p>
                <button
                  onClick={requestConsult}
                  disabled={inquireState !== 'idle'}
                  style={{
                    width: '100%', padding: '15px', borderRadius: 12, border: 'none',
                    background: inquireState === 'done' ? ACCENT_SOFT : ACCENT_DEEP,
                    color: inquireState === 'done' ? ACCENT_DEEP : '#fff',
                    fontSize: 15, fontWeight: 700, cursor: inquireState === 'idle' ? 'pointer' : 'default',
                  }}
                >
                  {inquireState === 'idle' && '상담 요청하기'}
                  {inquireState === 'sending' && '요청 중…'}
                  {inquireState === 'done' && '✓ 요청했어요, 곧 연락드릴게요'}
                </button>
              </>
            ) : (
              <p style={{ fontSize: 13, color: '#5C6B62', lineHeight: 1.7, marginTop: 16, marginBottom: 0 }}>
                정확한 한도와 신청 절차는 실제 서류 확인 후 결정됩니다. 전문 컨설턴트가 입력하신 연락처로 곧 연락드릴게요.
              </p>
            )}
          </div>
        )}

        <p style={{ fontSize: 11, color: '#A8AFA5', textAlign: 'center', margin: '28px 0 0' }}>머니콕 — 정책자금·지원금·노무 소식을 콕 집어 알려드려요</p>
      </div>
    </div>
  );
}

export default function PublicApplyPage() {
  return (
    <Suspense fallback={null}>
      <PublicApplyPageInner />
    </Suspense>
  );
}
