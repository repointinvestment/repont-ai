'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getSession } from '@/lib/session';
import AppHeader from '../../../components/AppHeader';
import PolicyFundDetailsFields from '../../../components/PolicyFundDetailsFields';

const OWNERSHIP_OPTIONS = ['자가', '임대', '가족소유'];
const SERVICE_PRESETS = ['소진공', '홈택스', '4대보험', '정부24', '아이핀'];
const STATUS_OPTIONS = ['상담중', '서류준비', '심사중', '완료'];

export default function CustomerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [user, setUser] = useState(null);
  const [form, setForm] = useState(null);
  const [businessAgeYears, setBusinessAgeYears] = useState('');
  const [policyFundDetails, setPolicyFundDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [extraCredentials, setExtraCredentials] = useState([]); // [{serviceName, username, password}]

  function addExtraCredential() {
    setExtraCredentials((prev) => [...prev, { serviceName: '', username: '', password: '', secondaryPassword: '', confirmed: false }]);
  }
  function updateExtraCredential(index, field, value) {
    setExtraCredentials((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  }
  async function removeExtraCredential(index) {
    const cred = extraCredentials[index];
    if (cred.credentialId) {
      try {
        await fetch(`/api/credentials/${cred.credentialId}`, {
          method: 'DELETE',
          headers: {
            'x-consultant-id': user?.username || '',
            'x-consultant-role': user?.role || '',
          },
        });
      } catch (err) {
        setError('삭제 중 오류가 발생했습니다.');
        return;
      }
    }
    setExtraCredentials((prev) => prev.filter((_, i) => i !== index));
  }
  async function confirmExtraCredential(index) {
    const cred = extraCredentials[index];
    if (!cred.serviceName) {
      setError('서비스명을 먼저 선택해주세요.');
      return;
    }
    setError(null);
    try {
      const res = await fetch(`/api/customers/${params.id}/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceName: cred.serviceName,
          username: cred.username,
          password: cred.password,
          secondaryPassword: cred.secondaryPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '저장 실패');
      setExtraCredentials((prev) => prev.map((c, i) => (
        i === index ? { ...c, confirmed: true, credentialId: data.credential.id, username: data.credential.username, password: '', secondaryPassword: '' } : c
      )));
    } catch (err) {
      setError(err.message || '계정 정보 저장 중 오류가 발생했습니다.');
    }
  }
  function editExtraCredential(index) {
    setExtraCredentials((prev) => prev.map((c, i) => (i === index ? { ...c, confirmed: false } : c)));
  }
  const [deleting, setDeleting] = useState(false);

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
        const c = data.customer;
        const FIXED_NAMES = ['주민등록번호', '공동인증서 비밀번호'];
        fetch(`/api/customers/${params.id}/credentials`)
          .then((r) => r.json())
          .then((d) => {
            const others = (d.credentials || []).filter((cred) => !FIXED_NAMES.includes(cred.service_name));
            setExtraCredentials(others.map((cred) => ({
              serviceName: cred.service_name,
              username: cred.username || '',
              password: '',
              secondaryPassword: '',
              confirmed: true,
              credentialId: cred.id,
            })));
          })
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
          residentNumber: '',
          certPassword: '',
          hasPatent: c.has_patent || false,
          hasYellowUmbrella: c.has_yellow_umbrella || false,
          hasRndCenter: c.has_rnd_center || false,
          hasVentureCert: c.has_venture_cert || false,
          ownerCareerYears: c.owner_career_years || '',
          hasWomanBizCert: c.has_woman_biz_cert || false,
          hasSojinkongGoodRepayment: c.has_sojinkong_good_repayment || false,
        });
        setBusinessAgeYears(c.business_age_years || '');
        setPolicyFundDetails(c.policy_fund_details || {});
      } catch (err) {
        setError('고객 정보를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

  function handleChange(e) {
    const { name, type, value, checked } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/customers/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, businessAgeYears, policyFundDetails }),
      });
      if (!res.ok) throw new Error();
      router.push(`/customers/${params.id}`);
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

      <PolicyFundDetailsFields
        businessAgeYears={businessAgeYears}
        onBusinessAgeYearsChange={setBusinessAgeYears}
        details={policyFundDetails}
        onDetailsChange={setPolicyFundDetails}
        inputStyle={inputStyle}
        labelStyle={labelStyle}
        sectionTitle={sectionTitle}
      />

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
      <p style={{ fontSize: 12, color: '#8A8A85', margin: '-4px 0 8px' }}>
        보안을 위해 저장된 값은 화면에 표시되지 않습니다. 값을 입력하고 저장하면 새 값으로 교체(또는 신규 등록)됩니다. 비워두면 기존 값이 그대로 유지됩니다.
      </p>
      <label style={labelStyle}>
        주민등록번호
        <input style={inputStyle} name="residentNumber" value={form.residentNumber} onChange={handleChange} placeholder="변경 시에만 입력하세요" />
      </label>
      <label style={labelStyle}>
        공동인증서 비밀번호
        <input style={inputStyle} name="certPassword" value={form.certPassword} onChange={handleChange} placeholder="변경 시에만 입력하세요" />
      </label>

      <p style={{ fontSize: 13, fontWeight: 600, color: '#5F5E5A', margin: '20px 0 10px' }}>추가 계정 정보</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
          {!SERVICE_PRESETS.includes(cred.serviceName) && cred.serviceName !== '' && (
            <label style={labelStyle}>
              서비스명 직접입력
              <input style={inputStyle} value={cred.serviceName} onChange={(e) => updateExtraCredential(i, 'serviceName', e.target.value)} placeholder="예: 정부24" />
            </label>
          )}
          {cred.serviceName === '' && (
            <label style={labelStyle}>
              서비스명 직접입력 (드롭다운에 없는 경우)
              <input style={inputStyle} value="" onChange={(e) => updateExtraCredential(i, 'serviceName', e.target.value)} placeholder="예: 정부24" />
            </label>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ ...labelStyle, flex: 1 }}>
              아이디
              <input style={inputStyle} value={cred.username} onChange={(e) => updateExtraCredential(i, 'username', e.target.value)} />
            </label>
            <label style={{ ...labelStyle, flex: 1 }}>
              비밀번호
              <input style={inputStyle} value={cred.password} onChange={(e) => updateExtraCredential(i, 'password', e.target.value)} placeholder="변경 시에만 입력" />
            </label>
            <label style={{ ...labelStyle, flex: 1 }}>
              2차 비밀번호 (아이핀 등, 선택)
              <input style={inputStyle} value={cred.secondaryPassword} onChange={(e) => updateExtraCredential(i, 'secondaryPassword', e.target.value)} placeholder="변경 시에만 입력" />
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
      <button type="button" onClick={addExtraCredential} style={{ alignSelf: 'flex-start', padding: '8px 14px', borderRadius: 8, border: '1px dashed #D3D1C7', background: '#fff', fontSize: 13, cursor: 'pointer', marginTop: 4 }}>+ 계정 추가</button>
      </div>

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
          onClick={() => router.push(`/customers/${params.id}`)}
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
