'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewCustomerPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    ownerName: '',
    businessName: '',
    phone: '',
    email: '',
    industry: '',
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
  const labelStyle = { fontSize: 13, color: '#5F5E5A' };

  return (
    <div style={{ padding: '32px 40px', maxWidth: 560, margin: '0 auto' }}>
      <p style={{ fontSize: 13, color: '#8A8A85', margin: '0 0 4px' }}>고객 등록</p>
      <h1 style={{ fontSize: 24, fontWeight: 500, margin: '0 0 24px' }}>
        신규 고객 정보를 입력해주세요.
      </h1>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <label style={labelStyle}>
          대표자명
          <input style={inputStyle} name="ownerName" value={form.ownerName} onChange={handleChange} placeholder="예: 김민수" />
        </label>
        <label style={labelStyle}>
          업체명
          <input style={inputStyle} name="businessName" value={form.businessName} onChange={handleChange} placeholder="예: 리포인트파트너스" />
        </label>
        <label style={labelStyle}>
          연락처
          <input style={inputStyle} name="phone" value={form.phone} onChange={handleChange} placeholder="예: 010-1234-5678" />
        </label>
        <label style={labelStyle}>
          이메일
          <input style={inputStyle} name="email" value={form.email} onChange={handleChange} placeholder="예: example@email.com" />
        </label>
        <label style={labelStyle}>
          업종
          <input style={inputStyle} name="industry" value={form.industry} onChange={handleChange} placeholder="예: 요식업" />
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
