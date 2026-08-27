'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getSession } from '@/lib/session';
import AppHeader from '../../components/AppHeader';
import DonutGauge from '../../components/DonutGauge';
import { estimateInstitutionLimits } from '@/lib/policyFundEstimate';
import { analyzePolicyFunds } from '@/lib/policyFundAnalysis';

const STAGE_STYLE = {
  '상담중': { bg: '#FAECE7', text: '#712B13' },
  '서류준비': { bg: '#FAEEDA', text: '#633806' },
  '심사중': { bg: '#E1F5EE', text: '#085041' },
  '완료': { bg: '#E6F1FB', text: '#0C447C' },
};

export default function CustomerDashboardPage() {
  const router = useRouter();
  const params = useParams();
  const [user, setUser] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [credentials, setCredentials] = useState([]);
  const [copyState, setCopyState] = useState({});
  const [files, setFiles] = useState([]);
  const [statusHistory, setStatusHistory] = useState([]);
  const [planDrafts, setPlanDrafts] = useState({});
  const [planLoading, setPlanLoading] = useState({});
  const [planCopyState, setPlanCopyState] = useState({});
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const session = getSession();
    if (!session) { router.push('/'); return; }
    if (session.role === 'student') { router.push('/menu'); return; }
    setUser(session);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/customers/${params.id}`);
        const data = await res.json();
        if (!res.ok) throw new Error();
        setCustomer(data.customer);
        fetch(`/api/customers/${params.id}/credentials`)
          .then((r) => r.json())
          .then((d) => setCredentials(d.credentials || []))
          .catch(() => {});
        loadFiles();
        fetch(`/api/customers/${params.id}/status-history`)
          .then((r) => r.json())
          .then((d) => setStatusHistory(d.history || []))
          .catch(() => {});
      } catch (err) {
        setError('고객 정보를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

  async function loadFiles() {
    try {
      const res = await fetch(`/api/customers/${params.id}/files`);
      const data = await res.json();
      setFiles(data.files || []);
    } catch (err) {
      // 조용히 무시 — 파일 목록은 부가 정보라 전체 화면 에러로 띄우지 않음
    }
  }

  const [dragActive, setDragActive] = useState(false);

  async function uploadFiles(fileList) {
    const selected = Array.from(fileList || []);
    if (selected.length === 0) return;
    setUploading(true);
    try {
      for (const file of selected) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`/api/customers/${params.id}/files`, {
          method: 'POST',
          headers: { 'x-consultant-id': user?.username || '' },
          body: formData,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || '업로드 실패');
        }
      }
      await loadFiles();
    } catch (err) {
      setError(err.message || '파일 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  }

  async function handleFileUpload(e) {
    await uploadFiles(e.target.files);
    e.target.value = '';
  }

  function handleDragOver(e) {
    e.preventDefault();
    setDragActive(true);
  }
  function handleDragLeave(e) {
    e.preventDefault();
    setDragActive(false);
  }
  async function handleDrop(e) {
    e.preventDefault();
    setDragActive(false);
    if (uploading) return;
    await uploadFiles(e.dataTransfer.files);
  }

  async function generatePlan(fundName, index) {
    setPlanLoading((s) => ({ ...s, [index]: true }));
    try {
      const pfd = customer.policy_fund_details || {};
      const res = await fetch('/api/business-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fundName,
          customer: {
            ownerName: customer.owner_name,
            businessName: customer.business_name,
            industry: customer.industry,
            bizAge: customer.business_age_years,
            businessContent: customer.business_content,
            revenue: customer.revenue_amount,
            creditNice: customer.credit_nice,
            creditKcb: customer.credit_kcb,
            employeeCount: customer.employee_count,
            smartDevices: pfd.smartDevices || [],
            hasPatent: customer.has_patent,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error();
      setPlanDrafts((s) => ({ ...s, [index]: data.draft }));
    } catch (err) {
      setError('사업계획서 초안 생성 중 오류가 발생했습니다.');
    } finally {
      setPlanLoading((s) => ({ ...s, [index]: false }));
    }
  }

  async function copyPlan(index) {
    try {
      await navigator.clipboard.writeText(planDrafts[index]);
      setPlanCopyState((s) => ({ ...s, [index]: '복사됨' }));
      setTimeout(() => setPlanCopyState((s) => ({ ...s, [index]: null })), 2000);
    } catch (err) {
      setPlanCopyState((s) => ({ ...s, [index]: '복사 실패' }));
    }
  }

  async function handleFileOpen(f) {
    try {
      const res = await fetch(`/api/customers/${params.id}/files/${f.id}/download`, {
        headers: {
          'x-consultant-id': user?.username || '',
          'x-consultant-role': user?.role || '',
        },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, '_blank');
    } catch (err) {
      setError('파일을 여는 중 오류가 발생했습니다.');
    }
  }

  async function handleFileDownload(f) {
    try {
      const res = await fetch(`/api/customers/${params.id}/files/${f.id}/download`, {
        headers: {
          'x-consultant-id': user?.username || '',
          'x-consultant-role': user?.role || '',
        },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = f.file_name; // 원본 파일명·확장자 그대로 저장
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError('파일을 다운로드하는 중 오류가 발생했습니다.');
    }
  }

  async function handleFileDelete(fileId) {
    if (!confirm('이 파일을 삭제하시겠어요?')) return;
    try {
      await fetch(`/api/customers/${params.id}/files/${fileId}`, { method: 'DELETE' });
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (err) {
      setError('파일 삭제 중 오류가 발생했습니다.');
    }
  }

  function formatSize(bytes) {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1)}MB` : `${Math.round(bytes / 1024)}KB`;
  }

  async function copyCredential(cred, field = 'password') {
    const stateKey = field === 'secondary' ? `${cred.id}-2` : `${cred.id}`;
    try {
      const res = await fetch(`/api/credentials/${cred.id}/copy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-consultant-id': user?.username || '',
          'x-consultant-role': user?.role || '',
        },
        body: JSON.stringify({ field }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error();
      await navigator.clipboard.writeText(data.value);
      setCopyState((s) => ({ ...s, [stateKey]: '복사됨' }));
      setTimeout(() => setCopyState((s) => ({ ...s, [stateKey]: null })), 2000);
    } catch (err) {
      setCopyState((s) => ({ ...s, [stateKey]: '복사 실패' }));
    }
  }

  if (!user) return null;
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F7F5F0' }}>
        <AppHeader user={user} />
        <div style={{ padding: 40, fontSize: 14, color: '#8A8A85' }}>불러오는 중...</div>
      </div>
    );
  }
  if (!customer) {
    return (
      <div style={{ minHeight: '100vh', background: '#F7F5F0' }}>
        <AppHeader user={user} />
        <div style={{ padding: 40, fontSize: 14, color: '#A32D2D' }}>{error || '고객 정보를 찾을 수 없습니다.'}</div>
      </div>
    );
  }

  const stage = STAGE_STYLE[customer.status] || STAGE_STYLE['상담중'];
  const hasDetailedData = customer.business_age_years !== null && customer.business_age_years !== undefined;
  const pfd = customer.policy_fund_details || {};
  const analysis = hasDetailedData
    ? analyzePolicyFunds({
        industry: customer.industry,
        bizAge: customer.business_age_years,
        sales: customer.revenue_amount,
        employees: customer.employee_count,
        creditKCB: customer.credit_kcb,
        creditNICE: customer.credit_nice,
        sojingongLoans: pfd.sojingongLoans,
        loans: pfd.loans,
        hasBankruptcy: pfd.hasBankruptcy,
        currentBizCount: pfd.currentBizCount,
        smartDevices: pfd.smartDevices,
        exportRecord: pfd.exportRecord,
        salesGrowth: pfd.salesGrowth,
        taxDelinquent: pfd.taxDelinquent,
        isFranchise: pfd.isFranchise,
        hasPatent: customer.has_patent,
        careerYears: customer.owner_career_years,
      })
    : null;
  const limits = estimateInstitutionLimits(customer);
  const maxLimit = Math.max(...limits.map((l) => l.limit || 0), 1);

  const statCard = { background: '#fff', borderRadius: 12, padding: '18px 20px', flex: 1, minWidth: 140 };
  const statLabel = { fontSize: 13, color: '#8A8A85', margin: '0 0 6px' };
  const statValue = { fontSize: 20, fontWeight: 700, color: '#2A2925', margin: 0 };

  return (
    <div style={{ minHeight: '100vh', background: '#F7F5F0' }}>
      <AppHeader user={user} />
      <div style={{ padding: '32px 40px', maxWidth: 880, margin: '0 auto' }}>
        <p style={{ fontSize: 13, color: '#8A8A85', margin: '0 0 4px' }}>고객 상세</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: '#2A2925' }}>
            {customer.owner_name || '이름 미입력'}
          </h1>
          <span style={{ fontSize: 15, color: '#8A8A85' }}>{customer.business_name}</span>
          <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: stage.bg, color: stage.text, fontWeight: 600 }}>
            {customer.status || '상담중'}
          </span>
        </div>
        <p style={{ fontSize: 13, color: '#8A8A85', margin: '0 0 4px' }}>
          {customer.industry} {customer.phone ? `· ${customer.phone}` : ''} {customer.email ? `· ${customer.email}` : ''}
        </p>
        {statusHistory.length > 0 && (
          <p style={{ fontSize: 13, color: '#8A8A85', margin: '0 0 16px', fontWeight: 600 }}>
            최초 상담일: {new Date(statusHistory[0].changed_at).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })}
          </p>
        )}

        {statusHistory.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 4px', marginBottom: 24 }}>
            {statusHistory.map((h, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{
                  fontSize: 12, padding: '5px 12px', borderRadius: 20,
                  background: (STAGE_STYLE[h.status] || STAGE_STYLE['상담중']).bg,
                  color: (STAGE_STYLE[h.status] || STAGE_STYLE['상담중']).text,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.5,
                }}>
                  <span style={{ fontWeight: 600 }}>{h.status}</span>
                  <span style={{ fontSize: 10, opacity: 0.75 }}>
                    {new Date(h.changed_at).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                  </span>
                </div>
                {i < statusHistory.length - 1 && (
                  <span style={{ margin: '0 4px', color: '#B0AEA5', fontSize: 13 }}>→</span>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          <div style={statCard}>
            <p style={statLabel}>매출액</p>
            <p style={statValue}>{customer.revenue_amount ? `${Number(customer.revenue_amount).toLocaleString()}만원` : '미입력'}</p>
          </div>
          <div style={statCard}>
            <p style={statLabel}>신용점수 NICE</p>
            <p style={statValue}>{customer.credit_nice || '미입력'}</p>
          </div>
          <div style={statCard}>
            <p style={statLabel}>신용점수 KCB</p>
            <p style={statValue}>{customer.credit_kcb || '미입력'}</p>
          </div>
        </div>

        {hasDetailedData ? (
          <div style={{ background: '#fff', borderRadius: 14, padding: '24px 28px', marginBottom: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <p style={{ fontSize: 15, fontWeight: 600, margin: 0, color: '#2A2925' }}>신청 가능한 정책자금</p>
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#E1F5EE', color: '#085041', fontWeight: 700 }}>실제 잔액 기준 정밀 계산</span>
            </div>

            {analysis.results.length === 0 ? (
              <p style={{ fontSize: 13, color: '#B0AEA5', margin: 0 }}>현재 조건으로 신청 가능한 상품이 없습니다. 아래 확인사항을 참고해주세요.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(() => {
                  const amounts = analysis.results.map((r) => Number((r.limit.match(/[\d,]+/) || ['0'])[0].replace(/,/g, '')));
                  return analysis.results.map((r, i) => (
                    <div key={i} style={{ border: `1px solid ${r.color}22`, borderLeft: `4px solid ${r.color}`, borderRadius: 8, padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <DonutGauge percent={r.cap ? (amounts[i] / r.cap) * 100 : 100} color={r.color} size={60} stroke={7} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: `${r.color}15`, color: r.color, fontWeight: 700 }}>{r.tag}</span>
                            <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: '#2A2925' }}>{r.name}</p>
                          </div>
                          <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px', color: r.color }}>{r.limit}</p>
                          <p style={{ fontSize: 12, color: '#8A8A85', margin: 0 }}>{r.condition}</p>
                          <p style={{ fontSize: 11, color: '#B0AEA5', margin: '4px 0 0' }}>{r.rate} · {r.period}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => generatePlan(r.name, i)}
                          disabled={planLoading[i]}
                          style={{ padding: '7px 12px', borderRadius: 6, border: `1px solid ${r.color}55`, background: '#fff', color: r.color, fontSize: 12, fontWeight: 600, cursor: planLoading[i] ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
                        >
                          {planLoading[i] ? '작성 중...' : planDrafts[i] ? '다시 작성' : '📝 사업계획서 초안'}
                        </button>
                      </div>
                      {planDrafts[i] && (
                        <div style={{ marginTop: 12, background: '#FAF9F6', border: '1px solid #E4E2DB', borderRadius: 8, padding: '14px 16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                            <button
                              type="button"
                              onClick={() => copyPlan(i)}
                              style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #D3D1C7', background: planCopyState[i] === '복사됨' ? '#E6F1FB' : '#fff', fontSize: 12, cursor: 'pointer' }}
                            >
                              {planCopyState[i] || '전체 복사'}
                            </button>
                          </div>
                          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.7, color: '#2A2925', margin: 0 }}>{planDrafts[i]}</pre>
                        </div>
                      )}
                    </div>
                  ));
                })()}
              </div>
            )}

            {analysis.checks.length > 0 && (
              <div style={{ marginTop: 16 }}>
                {analysis.checks.map((c, i) => (
                  <p key={i} style={{ fontSize: 12, color: '#5F5E5A', margin: '4px 0' }}>{c}</p>
                ))}
              </div>
            )}
            {analysis.warnings.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {analysis.warnings.map((w, i) => (
                  <p key={i} style={{ fontSize: 12, color: '#A32D2D', margin: '4px 0' }}>{w}</p>
                ))}
              </div>
            )}

            <p style={{ fontSize: 11, color: '#B0AEA5', margin: '16px 0 0', lineHeight: 1.6 }}>
              * 등록된 기관별 실제 잔액과 자격조건을 바탕으로 계산한 결과입니다. 최종 승인 여부는 각 기관 심사에 따라 달라질 수 있습니다.
            </p>
          </div>
        ) : (
        <div style={{ background: '#fff', borderRadius: 14, padding: '24px 28px', marginBottom: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <p style={{ fontSize: 15, fontWeight: 600, margin: 0, color: '#2A2925' }}>기관별 예상 가능 한도</p>
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#FAECE7', color: '#712B13', fontWeight: 700 }}>참고자료</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 20 }}>
            {limits.map((l) => (
              <div key={l.key} style={{ display: 'flex', alignItems: 'center', gap: 14, opacity: l.eligible === false ? 0.45 : 1 }}>
                <DonutGauge
                  percent={l.limit ? (l.limit / maxLimit) * 100 : (l.eligible ? 50 : 0)}
                  color={l.eligible === false ? '#B0AEA5' : '#BA7517'}
                />
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 2px', color: '#2A2925' }}>{l.name}</p>
                  <p style={{ fontSize: 13, color: '#5F5E5A', margin: 0 }}>
                    {l.limit ? `${l.limit.toLocaleString()}만원` : (l.eligible ? '조건 충족 (금액 상담 필요)' : '대상 아님')}
                  </p>
                  <p style={{ fontSize: 11, color: '#B0AEA5', margin: '2px 0 0' }}>{l.note}</p>
                </div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: '#B0AEA5', margin: '20px 0 0', lineHeight: 1.6 }}>
            * 매출·업종 기준의 간단 추정치입니다. <button type="button" onClick={() => router.push(`/customers/${params.id}/edit`)} style={{ background: 'none', border: 'none', padding: 0, color: '#D85A30', fontSize: 11, textDecoration: 'underline', cursor: 'pointer' }}>정보 수정</button>에서 기관별 실제 잔액과 자격조건을 입력하시면 정확한 신청 가능 상품과 한도로 바뀝니다.
          </p>
        </div>
        )}

        {(customer.loan_status || customer.memo) && (
          <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', marginBottom: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
            {customer.loan_status && (
              <>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#5F5E5A', margin: '0 0 4px' }}>대출현황</p>
                <p style={{ fontSize: 14, color: '#2A2925', margin: '0 0 16px', whiteSpace: 'pre-wrap' }}>{customer.loan_status}</p>
              </>
            )}
            {customer.memo && (
              <>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#5F5E5A', margin: '0 0 4px' }}>기타 메모</p>
                <p style={{ fontSize: 14, color: '#2A2925', margin: 0, whiteSpace: 'pre-wrap' }}>{customer.memo}</p>
              </>
            )}
          </div>
        )}

        {credentials.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', marginBottom: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
            <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 12px', color: '#2A2925' }}>계정 정보</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {credentials.map((cred) => {
                const primaryLabel = cred.service_name === '주민등록번호' ? '주민등록번호 복사' : '비밀번호 복사';
                return (
                <div key={cred.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #E4E2DB', borderRadius: 8, padding: '10px 14px' }}>
                  <span style={{ fontSize: 14 }}>
                    {cred.service_name}
                    {cred.username ? <span style={{ color: '#8A8A85' }}> · {cred.username}</span> : null}
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => copyCredential(cred, 'password')}
                      style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #D3D1C7', background: copyState[cred.id] === '복사됨' ? '#E6F1FB' : '#fff', fontSize: 13, cursor: 'pointer' }}
                    >
                      {copyState[cred.id] || primaryLabel}
                    </button>
                    {cred.has_secondary && (
                      <button
                        type="button"
                        onClick={() => copyCredential(cred, 'secondary')}
                        style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #D3D1C7', background: copyState[`${cred.id}-2`] === '복사됨' ? '#E6F1FB' : '#fff', fontSize: 13, cursor: 'pointer' }}
                      >
                        {copyState[`${cred.id}-2`] || '2차 비밀번호 복사'}
                      </button>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 파일 보관함 */}
        <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', marginBottom: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <p style={{ fontSize: 15, fontWeight: 600, margin: 0, color: '#2A2925' }}>파일 보관함</p>
            <label style={{ fontSize: 13, padding: '6px 14px', borderRadius: 6, background: uploading ? '#D3D1C7' : '#D85A30', color: '#fff', cursor: uploading ? 'default' : 'pointer' }}>
              {uploading ? '업로드 중...' : '파일 업로드'}
              <input type="file" multiple accept=".pdf,.hwp,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp" onChange={handleFileUpload} disabled={uploading} style={{ display: 'none' }} />
            </label>
          </div>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              border: dragActive ? '2px dashed #D85A30' : '2px dashed transparent',
              borderRadius: 10,
              background: dragActive ? '#FFF6F2' : 'transparent',
              padding: dragActive ? 12 : 0,
              transition: 'all 0.15s',
            }}
          >
            {files.length === 0 ? (
              <p style={{ fontSize: 13, color: '#B0AEA5', margin: 0, padding: dragActive ? 0 : '4px 0' }}>
                {dragActive ? '여기에 놓으면 업로드됩니다' : '아직 업로드된 파일이 없습니다. 사업계획서, 재무제표, 스캔본 등을 끌어다 놓거나 업로드해보세요.'}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {files.map((f) => (
                  <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #E4E2DB', borderRadius: 8, padding: '10px 14px' }}>
                    <button
                      type="button"
                      onClick={() => handleFileOpen(f)}
                      style={{ fontSize: 14, color: '#2A2925', background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      📄 {f.file_name}
                    </button>
                    <span style={{ fontSize: 12, color: '#B0AEA5', marginRight: 12 }}>{formatSize(f.size_bytes)}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => handleFileDownload(f)}
                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #D3D1C7', background: '#fff', color: '#2A2925', fontSize: 12, cursor: 'pointer' }}
                      >
                        다운로드
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFileDelete(f.id)}
                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #E4B3A5', background: '#fff', color: '#A32D2D', fontSize: 12, cursor: 'pointer' }}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ marginBottom: 32 }}>
          <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 12px', color: '#2A2925' }}>작성 서비스</p>
          <div
            onClick={() => router.push(`/chat?customerId=${params.id}`)}
            style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}
          >
            <span style={{ fontSize: 24 }}>🤖</span>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 2px', color: '#2A2925' }}>AI 정책자금 분석</p>
              <p style={{ fontSize: 13, color: '#8A8A85', margin: 0 }}>이 고객 정보를 바탕으로 맞는 정책자금을 분석해보세요.</p>
            </div>
          </div>
        </div>

        {error && <p style={{ fontSize: 13, color: '#A32D2D', margin: '0 0 16px' }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => router.push(`/customers/${params.id}/edit`)}
            style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: '#D85A30', color: '#fff', fontSize: 14, cursor: 'pointer' }}
          >
            정보 수정
          </button>
          <button
            onClick={() => router.push('/customers')}
            style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid #D3D1C7', background: '#fff', fontSize: 14, cursor: 'pointer' }}
          >
            고객 목록으로
          </button>
        </div>
      </div>
    </div>
  );
}
