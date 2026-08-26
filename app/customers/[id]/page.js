'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getSession } from '@/lib/session';
import AppHeader from '../../components/AppHeader';

const OWNERSHIP_OPTIONS = ['자가', '임대', '가족소유'];
const STATUS_OPTIONS = ['상담중', '서류준비', '심사중', '완료'];

export default function CustomerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [user, setUser] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [credentials, setCredentials] = useState([]);
  const [copyState, setCopyState] = useState({}); // { [credentialId]: '복사됨' | '복사 실패' }

  useEffect(() => {
    const session = getSession();
    if (!session) { router.push('/'); return; }
    if (session.role === 'student') { router.push('/menu'); return; }
    setUser(session);
  }, []);

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

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/customers/${params.id}`);
        const data = await res.json();
        if (!res.ok) throw new Error();
        const c = data.customer;
        fetch(`/api/customers/${params.id}/credentials`)
          .then((r) => r.json())
          .then((d) => setCredentials(d.credentials || []))
          .catch(() => {});
        setForm({
          businessName: c.business_name || '',
          businessType: c.business_type || '',
          ownerName: c.owner_name || '',
          phone: c.phone || '',
          email: c.email || '',
          industry: c.industry || '',
          bizRegNumber: c.biz_reg_number || '',
          establishDate: c.establish_date || '',
          openDate: c.open_date || '',
          revenueAmount: c.revenue_amount || '',
          creditNice: c.credit_nice || '',
          creditKcb: c.credit_kcb || '',
          address: c.address || '',
          addressOwnership: c.address_ownership || '자가',
          residenceAddress: c.residence_address || '',
          residenceOwnership: c.residence_ownership || '자가',
          loanStatus: c.loan_status || '',
          memo: c.memo || '',
          status: c.status || '상담중',
        });
      } catch (err) {
        setError('고객 정보를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/customers/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      router.push('/customers');
    } catch (err) {
      setError('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('정말 이 고객을 삭제하시겠어요? 되돌릴 수 없습니다.')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/customers/${params.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      router.push('/customers');
    } catch (err) {
      setError('삭제 중 오류가 발생했습니다.');
      setDeleting(false);
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #D3D1C7',
    fontSize: 14,
    marginTop: 6,
    boxSizing: 'border-box',
  };
  const labelStyle = { fontSize: 13, color: '#5F5E5A' };
  const sectionTitle = { fontSize: 15, fontWeight: 500, margin: '24px 0 4px' };
  const row = { display: 'flex', gap: 12 };
  const half = { flex: 1 };

  if (!user) return null;
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <AppHeader user={user} />
        <div style={{ padding: 40, fontSize: 14, color: '#8A8A85' }}>불러오는 중...</div>
      </div>
    );
  }
  if (!form) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <AppHeader user={user} />
        <div style={{ padding: 40, fontSize: 14, color: '#A32D2D' }}>{error || '고객 정보를 찾을 수 없습니다.'}</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
    <AppHeader user={user} />
    <div style={{ padding: '32px 40px', maxWidth: 640, margin: '0 auto' }}>
      <p style={{ fontSize: 13, color: '#8A8A85', margin: '0 0 4px' }}>고객 상세</p>
      <h1 style={{ fontSize: 24, fontWeight: 500, margin: '0 0 16px' }}>
        {form.ownerName || '고객'} 정보 수정
      </h1>

      <label style={labelStyle}>
        진행 단계
        <select style={inputStyle} name="status" value={form.status} onChange={handleChange}>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>

      <p style={sectionTitle}>기본 정보</p>
      <div style={row}>
        <label style={{ ...labelStyle, ...half }}>
          대표자명
          <input style={inputStyle} name="ownerName" value={form.ownerName} onChange={handleChange} />
        </label>
        <label style={{ ...labelStyle, ...half }}>
          업체명
          <input style={inputStyle} name="businessName" value={form.businessName} onChange={handleChange} />
        </label>
      </div>
      <div style={row}>
        <label style={{ ...labelStyle, ...half }}>
          연락처
          <input style={inputStyle} name="phone" value={form.phone} onChange={handleChange} />
        </label>
        <label style={{ ...labelStyle, ...half }}>
          이메일
          <input style={inputStyle} name="email" value={form.email} onChange={handleChange} />
        </label>
      </div>
      <div style={row}>
        <label style={{ ...labelStyle, ...half }}>
          업종
          <input style={inputStyle} name="industry" value={form.industry} onChange={handleChange} />
        </label>
        <label style={{ ...labelStyle, ...half }}>
          사업자등록번호
          <input style={inputStyle} name="bizRegNumber" value={form.bizRegNumber} onChange={handleChange} />
        </label>
      </div>
      <div style={row}>
        <label style={{ ...labelStyle, ...half }}>
          사업자등록일
          <input style={inputStyle} name="establishDate" value={form.establishDate} onChange={handleChange} />
        </label>
        <label style={{ ...labelStyle, ...half }}>
          개업연도
          <input style={inputStyle} name="openDate" value={form.openDate} onChange={handleChange} />
        </label>
      </div>

      <p style={sectionTitle}>재무 / 신용 정보</p>
      <label style={labelStyle}>
        매출액 (만원)
        <input style={inputStyle} name="revenueAmount" value={form.revenueAmount} onChange={handleChange} />
      </label>
      <div style={row}>
        <label style={{ ...labelStyle, ...half }}>
          신용점수 NICE
          <input style={inputStyle} name="creditNice" value={form.creditNice} onChange={handleChange} />
        </label>
        <label style={{ ...labelStyle, ...half }}>
          신용점수 KCB
          <input style={inputStyle} name="creditKcb" value={form.creditKcb} onChange={handleChange} />
        </label>
      </div>

      <p style={sectionTitle}>주소 정보</p>
      <div style={row}>
        <label style={{ ...labelStyle, flex: 2 }}>
          사업장 소재지
          <input style={inputStyle} name="address" value={form.address} onChange={handleChange} />
        </label>
        <label style={{ ...labelStyle, ...half }}>
          사업장 소유형태
          <select style={inputStyle} name="addressOwnership" value={form.addressOwnership} onChange={handleChange}>
            {OWNERSHIP_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
      </div>
      <div style={row}>
        <label style={{ ...labelStyle, flex: 2 }}>
          거주지
          <input style={inputStyle} name="residenceAddress" value={form.residenceAddress} onChange={handleChange} />
        </label>
        <label style={{ ...labelStyle, ...half }}>
          거주지 소유형태
          <select style={inputStyle} name="residenceOwnership" value={form.residenceOwnership} onChange={handleChange}>
            {OWNERSHIP_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
      </div>

      <p style={sectionTitle}>대출 / 메모</p>
      <label style={labelStyle}>
        대출현황
        <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} name="loanStatus" value={form.loanStatus} onChange={handleChange} />
      </label>
      <label style={labelStyle}>
        기타 메모
        <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} name="memo" value={form.memo} onChange={handleChange} />
      </label>

      {credentials.length > 0 && (
        <>
          <p style={sectionTitle}>계정 정보</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {credentials.map((cred) => (
              <div
                key={cred.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  border: '1px solid #E4E2DB',
                  borderRadius: 8,
                  padding: '10px 14px',
                }}
              >
                <span style={{ fontSize: 14 }}>{cred.service_name}</span>
                <button
                  type="button"
                  onClick={() => copyCredential(cred)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: '1px solid #D3D1C7',
                    background: copyState[cred.id] === '복사됨' ? '#E6F1FB' : '#fff',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  {copyState[cred.id] || '복사'}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {error && <p style={{ fontSize: 13, color: '#A32D2D', margin: '16px 0 0' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '10px 18px',
            borderRadius: 8,
            border: 'none',
            background: '#D85A30',
            color: '#fff',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          {saving ? '저장 중...' : '저장하기'}
        </button>
        <button
          onClick={() => router.push('/customers')}
          style={{
            padding: '10px 18px',
            borderRadius: 8,
            border: '1px solid #D3D1C7',
            background: '#fff',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          취소
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          style={{
            padding: '10px 18px',
            borderRadius: 8,
            border: '1px solid #F0997B',
            background: '#fff',
            color: '#993C1D',
            fontSize: 14,
            cursor: 'pointer',
            marginLeft: 'auto',
          }}
        >
          {deleting ? '삭제 중...' : '고객 삭제'}
        </button>
      </div>
    </div>
    </div>
  );
}
