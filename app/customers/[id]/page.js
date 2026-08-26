'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getSession } from '@/lib/session';
import AppHeader from '../../components/AppHeader';
import DonutGauge from '../../components/DonutGauge';
import { estimateInstitutionLimits } from '@/lib/policyFundEstimate';

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

  async function handleFileUpload(e) {
    const selected = Array.from(e.target.files || []);
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
      e.target.value = '';
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

  async function copyCredential(cred) {
    try {
      const res = await fetch(`/api/credentials/${cred.id}/copy`, {
        method: 'POST',
        headers: {
          'x-consultant-id': user?.username || '',
          'x-consultant-role': user?.role || '',
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error();
      await navigator.clipboard.writeText(data.value);
      setCopyState((s) => ({ ...s, [cred.id]: '복사됨' }));
      setTimeout(() => setCopyState((s) => ({ ...s, [cred.id]: null })), 2000);
    } catch (err) {
      setCopyState((s) => ({ ...s, [cred.id]: '복사 실패' }));
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
        <p style={{ fontSize: 13, color: '#8A8A85', margin: '0 0 24px' }}>
          {customer.industry} {customer.phone ? `· ${customer.phone}` : ''} {customer.email ? `· ${customer.email}` : ''}
        </p>

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
            * AI 상담 시스템에 반영된 기준(매출·업종 요건)을 바탕으로 한 예상치입니다. 업력, 재신청 대기기간, 매출초과차입금 등 개별 조건은 AI 상담에서 추가로 확인해주세요. 기관별 실사용 금액은 아직 반영되어 있지 않습니다.
          </p>
        </div>

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
              {credentials.map((cred) => (
                <div key={cred.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #E4E2DB', borderRadius: 8, padding: '10px 14px' }}>
                  <span style={{ fontSize: 14 }}>{cred.service_name}</span>
                  <button
                    type="button"
                    onClick={() => copyCredential(cred)}
                    style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #D3D1C7', background: copyState[cred.id] === '복사됨' ? '#E6F1FB' : '#fff', fontSize: 13, cursor: 'pointer' }}
                  >
                    {copyState[cred.id] || '복사'}
                  </button>
                </div>
              ))}
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
          {files.length === 0 ? (
            <p style={{ fontSize: 13, color: '#B0AEA5', margin: 0 }}>아직 업로드된 파일이 없습니다. 사업계획서, 재무제표, 스캔본 등을 올려보세요.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {files.map((f) => (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #E4E2DB', borderRadius: 8, padding: '10px 14px' }}>
                  <a href={f.blob_url} target="_blank" rel="noreferrer" style={{ fontSize: 14, color: '#2A2925', textDecoration: 'none', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    📄 {f.file_name}
                  </a>
                  <span style={{ fontSize: 12, color: '#B0AEA5', marginRight: 12 }}>{formatSize(f.size_bytes)}</span>
                  <button
                    type="button"
                    onClick={() => handleFileDelete(f.id)}
                    style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #E4B3A5', background: '#fff', color: '#A32D2D', fontSize: 12, cursor: 'pointer' }}
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 32 }}>
          <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 12px', color: '#2A2925' }}>작성 서비스</p>
          <div
            onClick={() => router.push('/chat')}
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
