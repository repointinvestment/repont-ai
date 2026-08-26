'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const OWNERSHIP_OPTIONS = ['자가', '임대', '가족소유'];

export default function NewCustomerPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    ownerName: '',
    businessName: '',
    phone: '',
    email: '',
    industry: '',
    bizRegNumber: '',
    establishDate: '',
    openDate: '',
    revenueAmount: '',
    creditNice: '',
    creditKcb: '',
    address: '',
    addressOwnership: '자가',
    residenceAddress: '',
    residenceOwnership: '자가',
    loanStatus: '',
    memo: '',
    residentNumber: '',
    certPassword: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.ownerName) {
      setError('대표자명을 입력해주세요.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-consultant-id': localStorage.getItem('consultantId') || '',
        },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('등록 실패');
      router.push('/customers');
    } catch (err) {
      setError('고객 등록 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
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
  const selectStyle = { ...inputStyle };
  const labelStyle = { fontSize: 13, color: '#5F5E5A' };
  const sectionTitle = { fontSize: 15, fontWeight: 500, margin: '24px 0 4px' };
  const row = { display: 'flex', gap: 12 };
  const half = { flex: 1 };

  return (
    <div style={{ padding: '32px 40px', maxWidth: 640, margin: '0 auto' }}>
      <p style={{ fontSize: 13, color: '#8A8A85', margin: '0 0 4px' }}>고객 등록</p>
      <h1 style={{ fontSize: 24, fontWeight: 500, margin: '0 0 16px' }}>
        신규 고객 정보를 입력해주세요.
      </h1>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        <p style={sectionTitle}>기본 정보</p>
        <div style={row}>
          <label style={{ ...labelStyle, ...half }}>
            대표자명
            <input style={inputStyle} name="ownerName" value={form.ownerName} onChange={handleChange} placeholder="예: 김민수" />
          </label>
          <label style={{ ...labelStyle, ...half }}>
            업체명
            <input style={inputStyle} name="businessName" value={form.businessName} onChange={handleChange} placeholder="예: 리포인트파트너스" />
          </label>
        </div>
        <div style={row}>
          <label style={{ ...labelStyle, ...half }}>
            연락처
            <input style={inputStyle} name="phone" value={form.phone} onChange={handleChange} placeholder="예: 010-1234-5678" />
          </label>
          <label style={{ ...labelStyle, ...half }}>
            이메일
            <input style={inputStyle} name="email" value={form.email} onChange={handleChange} placeholder="예: example@email.com" />
          </label>
        </div>
        <div style={row}>
          <label style={{ ...labelStyle, ...half }}>
            업종
            <input style={inputStyle} name="industry" value={form.industry} onChange={handleChange} placeholder="예: 요식업" />
          </label>
          <label style={{ ...labelStyle, ...half }}>
            사업자등록번호
            <input style={inputStyle} name="bizRegNumber" value={form.bizRegNumber} onChange={handleChange} placeholder="예: 123-45-67890" />
          </label>
        </div>
               <div style={row}>
          <label style={{ ...labelStyle, ...half }}>
            사업자등록일
            <input style={inputStyle} name="establishDate" value={form.establishDate} onChange={handleChange} placeholder="예: 2019년 10월 1일" />
          </label>
          <label style={{ ...labelStyle, ...half }}>
            개업연도
            <input style={inputStyle} name="openDate" value={form.openDate} onChange={handleChange} placeholder="예: 2019년 10월 1일" />
          </label>
        </div>
        <p style={sectionTitle}>재무 / 신용 정보</p>
        <label style={labelStyle}>
          매출액 (만원)
          <input style={inputStyle} name="revenueAmount" value={form.revenueAmount} onChange={handleChange} placeholder="예: 8000" />
        </label>
        <div style={row}>
          <label style={{ ...labelStyle, ...half }}>
            신용점수 NICE
            <input style={inputStyle} name="creditNice" value={form.creditNice} onChange={handleChange} placeholder="예: 750" />
          </label>
          <label style={{ ...labelStyle, ...half }}>
            신용점수 KCB
            <input style={inputStyle} name="creditKcb" value={form.creditKcb} onChange={handleChange} placeholder="예: 780" />
          </label>
        </div>

        <p style={sectionTitle}>주소 정보</p>
        <div style={row}>
          <label style={{ ...labelStyle, flex: 2 }}>
            사업장 소재지
            <input style={inputStyle} name="address" value={form.address} onChange={handleChange} placeholder="예: 부산 해운대구 ..." />
          </label>
          <label style={{ ...labelStyle, ...half }}>
            사업장 소유형태
            <select style={selectStyle} name="addressOwnership" value={form.addressOwnership} onChange={handleChange}>
              {OWNERSHIP_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
        </div>
        <div style={row}>
          <label style={{ ...labelStyle, flex: 2 }}>
            거주지
            <input style={inputStyle} name="residenceAddress" value={form.residenceAddress} onChange={handleChange} placeholder="예: 부산 남구 ..." />
          </label>
          <label style={{ ...labelStyle, ...half }}>
            거주지 소유형태
            <select style={selectStyle} name="residenceOwnership" value={form.residenceOwnership} onChange={handleChange}>
              {OWNERSHIP_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
        </div>

        <p style={sectionTitle}>대출 / 메모</p>
        <label style={labelStyle}>
          대출현황 (자유 입력)
          <textarea
            style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
            name="loanStatus"
            value={form.loanStatus}
            onChange={handleChange}
            placeholder="예: 정책자금(사업장대출) 스마트자금 3000만원, 신용취약 3000..."
          />
        </label>
        <label style={labelStyle}>
          기타 메모
          <textarea
            style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
            name="memo"
            value={form.memo}
            onChange={handleChange}
            placeholder="특이사항, 상담 이력 등 자유롭게 입력"
          />
        </label>

        <p style={sectionTitle}>계정 정보 (암호화 저장)</p>
        <label style={labelStyle}>
          주민등록번호
          <input style={inputStyle} name="residentNumber" value={form.residentNumber} onChange={handleChange} placeholder="예: 851217-2379713" />
        </label>
        <label style={labelStyle}>
          공동인증서 비밀번호
          <input style={inputStyle} name="certPassword" value={form.certPassword} onChange={handleChange} placeholder="공동인증서 비밀번호" />
        </label>

        {error && <p style={{ fontSize: 13, color: '#A32D2D', margin: 0 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            type="submit"
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
            {saving ? '등록 중...' : '등록하기'}
          </button>
          <button
            type="button"
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
        </div>
      </form>
    </div>
  );
}
