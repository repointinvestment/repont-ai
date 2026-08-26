'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/session';
import AppHeader from '../../components/AppHeader';

const OWNERSHIP_OPTIONS = ['자가', '임대', '가족소유'];
const SERVICE_PRESETS = ['소진공', '홈택스', '4대보험', '정부24', '아이핀'];

export default function NewCustomerPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const session = getSession();
    if (!session) { router.push('/'); return; }
    if (session.role === 'student') { router.push('/menu'); return; }
    setUser(session);
  }, []);

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
    hasPatent: false,
    hasYellowUmbrella: false,
    hasRndCenter: false,
    hasVentureCert: false,
    ownerCareerYears: '',
    hasWomanBizCert: false,
    hasSojinkongGoodRepayment: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [extraCredentials, setExtraCredentials] = useState([]); // [{serviceName, username, password}]

  function addExtraCredential() {
    setExtraCredentials((prev) => [...prev, { serviceName: '', username: '', password: '', secondaryPassword: '', confirmed: false }]);
  }
  function updateExtraCredential(index, field, value) {
    setExtraCredentials((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  }
  function removeExtraCredential(index) {
    setExtraCredentials((prev) => prev.filter((_, i) => i !== index));
  }
  function confirmExtraCredential(index) {
    const cred = extraCredentials[index];
    if (!cred.serviceName) {
      setError('서비스명을 먼저 선택해주세요.');
      return;
    }
    setError(null);
    setExtraCredentials((prev) => prev.map((c, i) => (i === index ? { ...c, confirmed: true } : c)));
  }
  function editExtraCredential(index) {
    setExtraCredentials((prev) => prev.map((c, i) => (i === index ? { ...c, confirmed: false } : c)));
  }

  function handleChange(e) {
    const { name, type, value, checked } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.ownerName) {
      setError('대표자명을 입력해주세요.');
      return;
    }
    const incompleteCred = extraCredentials.find((c) => !c.serviceName && (c.username || c.password || c.secondaryPassword));
    if (incompleteCred) {
      setError('추가 계정 정보에 아이디/비밀번호를 입력하셨다면, 서비스명도 선택해주세요.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-consultant-id': user?.username || '',
        },
        body: JSON.stringify({ ...form, additionalCredentials: extraCredentials.filter((c) => c.serviceName) }),
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

  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
    <AppHeader user={user} />
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
            <input style={inputStyle} name="businessName" value={form.businessName} onChange={handleChange} placeholder="예: 00상사" />
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

        <p style={sectionTitle}>기보(기술보증기금) 자격 확인</p>
        <p style={{ fontSize: 12, color: '#8A8A85', margin: '-4px 0 8px' }}>
          핵심 조건은 특허보유 또는 대표자 경력 10년 이상입니다. 노란우산공제·기업부설연구소·벤처인증은 직접 자격요건은 아니고, 심사 시 가점요소로 참고됩니다.
        </p>
        <label style={labelStyle}>
          대표자 경력(년)
          <input type="number" style={inputStyle} name="ownerCareerYears" value={form.ownerCareerYears} onChange={handleChange} placeholder="예: 12" />
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px', marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
            <input type="checkbox" name="hasPatent" checked={form.hasPatent} onChange={handleChange} /> 특허보유
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
            <input type="checkbox" name="hasYellowUmbrella" checked={form.hasYellowUmbrella} onChange={handleChange} /> 노란우산공제 (소진공 가점)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
            <input type="checkbox" name="hasWomanBizCert" checked={form.hasWomanBizCert} onChange={handleChange} /> 여성기업확인서 (소진공 가점)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
            <input type="checkbox" name="hasSojinkongGoodRepayment" checked={form.hasSojinkongGoodRepayment} onChange={handleChange} /> 소진공 직접대출 성실상환 이력 (소진공 가점)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
            <input type="checkbox" name="hasRndCenter" checked={form.hasRndCenter} onChange={handleChange} /> 기업부설연구소 (가점)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
            <input type="checkbox" name="hasVentureCert" checked={form.hasVentureCert} onChange={handleChange} /> 벤처인증 (가점)
          </label>
        </div>

        <p style={sectionTitle}>계정 정보 (암호화 저장)</p>
        <label style={labelStyle}>
          주민등록번호
          <input style={inputStyle} name="residentNumber" value={form.residentNumber} onChange={handleChange} placeholder="예: 851217-2379713" />
        </label>
        <label style={labelStyle}>
          공동인증서 비밀번호
          <input style={inputStyle} name="certPassword" value={form.certPassword} onChange={handleChange} placeholder="공동인증서 비밀번호" />
        </label>

        <p style={{ fontSize: 13, fontWeight: 600, color: '#5F5E5A', margin: '4px 0 -4px' }}>추가 계정 정보</p>
        {extraCredentials.map((cred, i) => (
          cred.confirmed ? (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', border: '1px solid #E4E2DB', borderRadius: 8, background: '#FAFAF8' }}>
              <span style={{ fontSize: 14 }}>
                ✓ {cred.serviceName}
                {cred.username ? <span style={{ color: '#8A8A85' }}> · {cred.username}</span> : null}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={() => editExtraCredential(i)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #D3D1C7', background: '#fff', fontSize: 13, cursor: 'pointer' }}>수정</button>
                <button type="button" onClick={() => removeExtraCredential(i)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #D3D1C7', background: '#fff', fontSize: 13, cursor: 'pointer' }}>삭제</button>
              </div>
            </div>
          ) : (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, border: '1px solid #E4E2DB', borderRadius: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <label style={{ ...labelStyle, flex: 1 }}>
                서비스명
                <select
                  style={inputStyle}
                  value={SERVICE_PRESETS.includes(cred.serviceName) || cred.serviceName === '' ? cred.serviceName : '기타'}
                  onChange={(e) => updateExtraCredential(i, 'serviceName', e.target.value === '기타' ? '' : e.target.value)}
                >
                  <option value="">선택하세요</option>
                  {SERVICE_PRESETS.map((s) => <option key={s} value={s}>{s}</option>)}
                  <option value="기타">기타(직접입력)</option>
                </select>
              </label>
              <button type="button" onClick={() => removeExtraCredential(i)} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #D3D1C7', background: '#fff', fontSize: 13, cursor: 'pointer' }}>삭제</button>
            </div>
            {cred.serviceName === '' && (
              <label style={labelStyle}>
                서비스명 직접입력 (드롭다운에 없는 경우)
                <input style={inputStyle} value="" onChange={(e) => updateExtraCredential(i, 'serviceName', e.target.value)} placeholder="예: 정부24" />
              </label>
            )}
            {!SERVICE_PRESETS.includes(cred.serviceName) && cred.serviceName !== '' && (
              <label style={labelStyle}>
                서비스명 직접입력
                <input style={inputStyle} value={cred.serviceName} onChange={(e) => updateExtraCredential(i, 'serviceName', e.target.value)} placeholder="예: 정부24" />
              </label>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <label style={{ ...labelStyle, flex: 1 }}>
                아이디
                <input style={inputStyle} value={cred.username} onChange={(e) => updateExtraCredential(i, 'username', e.target.value)} />
              </label>
              <label style={{ ...labelStyle, flex: 1 }}>
                비밀번호
                <input style={inputStyle} value={cred.password} onChange={(e) => updateExtraCredential(i, 'password', e.target.value)} />
              </label>
              <label style={{ ...labelStyle, flex: 1 }}>
                2차 비밀번호 (아이핀 등, 선택)
                <input style={inputStyle} value={cred.secondaryPassword} onChange={(e) => updateExtraCredential(i, 'secondaryPassword', e.target.value)} />
              </label>
            </div>
            <button
              type="button"
              onClick={() => confirmExtraCredential(i)}
              style={{ alignSelf: 'flex-end', padding: '8px 16px', borderRadius: 8, border: 'none', background: '#2A2925', color: '#fff', fontSize: 13, cursor: 'pointer' }}
            >
              확인
            </button>
          </div>
          )
        ))}
        <button type="button" onClick={addExtraCredential} style={{ alignSelf: 'flex-start', padding: '8px 14px', borderRadius: 8, border: '1px dashed #D3D1C7', background: '#fff', fontSize: 13, cursor: 'pointer' }}>+ 계정 추가</button>

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
    </div>
  );
}
