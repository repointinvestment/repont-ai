'use client';

// app/admin/codef-test/page.jsx
// CODEF 데모 버전 연동 테스트용 화면 (admin 전용).
// 사업자등록 증명 API를 비회원 간편인증(카카오톡 등)으로 요청 → 승인 대기 → 확인, 2단계로 동작.
// 실제 서비스에 노출되는 화면이 아니라 CODEF 쪽에 전달할 테스트 검증용.

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/session';
import AppHeader from '../../components/AppHeader';

const LEVELS = [
  { value: '1', label: '카카오톡' },
  { value: '3', label: '삼성패스' },
  { value: '4', label: 'KB모바일' },
  { value: '5', label: '통신사(PASS)' },
  { value: '6', label: '네이버' },
  { value: '7', label: '신한인증서' },
  { value: '8', label: 'toss' },
  { value: '9', label: '뱅크샐러드' },
  { value: '10', label: 'NH인증서' },
  { value: '11', label: '우리인증서' },
];

export default function CodefTestPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({
    customerId: '', userName: '', residentNo: '', phoneNo: '', loginTypeLevel: '1', telecom: '0',
  });
  const [sessionId, setSessionId] = useState(null);
  const [status, setStatus] = useState(''); // '', 'requesting', 'pending', 'confirming', 'done', 'error'
  const [message, setMessage] = useState('');
  const [raw, setRaw] = useState(null);
  const [items, setItems] = useState([]);
  const [savedFiles, setSavedFiles] = useState([]);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    const s = getSession();
    if (!s) { router.push('/'); return; }
    if (s.role !== 'admin') { router.push('/menu'); return; }
    setUser(s);
  }, []);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function requestAuth() {
    setStatus('requesting');
    setMessage('');
    setRaw(null);
    setItems([]);
    setSavedFiles([]);
    setShowRaw(false);
    try {
      const res = await fetch('/api/codef/business-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-consultant-id': user.username },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      setRaw(data.raw || data.result || data);
      if (!res.ok) {
        setStatus('error');
        setMessage(data.error || '요청 실패');
        return;
      }
      if (data.status === 'pending_2way') {
        setSessionId(data.sessionId);
        setStatus('pending');
        setMessage(data.message);
      } else {
        setStatus('done');
        setMessage('추가 인증 없이 바로 완료되었습니다.');
      }
    } catch (err) {
      setStatus('error');
      setMessage(err.message);
    }
  }

  async function confirmAuth() {
    if (!sessionId) return;
    setStatus('confirming');
    setMessage('CODEF 응답을 기다리는 중입니다 (최대 4분 30초 정도 걸릴 수 있어요)...');
    try {
      const res = await fetch('/api/codef/business-registration/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      setRaw(data.result || data);
      if (!res.ok) {
        setStatus('error');
        setMessage(data.error || '확인 실패');
        return;
      }
      if (data.status === 'pending_2way') {
        setStatus('pending');
        setMessage('한 번 더 추가 인증이 필요합니다. 인증 앱을 확인하고 다시 확인 버튼을 눌러주세요.');
      } else if (data.status === 'done') {
        setStatus('done');
        const docs = Array.isArray(data.result?.data) ? data.result.data : data.result?.data ? [data.result.data] : [];
        setItems(docs);
        setSavedFiles(data.savedFiles || []);
        setMessage(
          data.savedFiles?.length > 0
            ? `발급 성공! 고객 파일함에 ${data.savedFiles.length}건 저장했습니다.`
            : '발급 성공! (고객 ID를 입력하지 않아 파일함에는 저장하지 않았습니다)'
        );
      } else {
        setStatus('error');
        setMessage(data.result?.result?.message || '실패');
      }
    } catch (err) {
      setStatus('error');
      setMessage(err.message);
    }
  }

  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <AppHeader user={user} />
      <div style={{ padding: '32px 40px', maxWidth: 640, margin: '0 auto' }}>
        <p style={{ fontSize: 13, color: '#8A8A85', margin: '0 0 4px' }}>CODEF 연동 테스트</p>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 6px', color: '#2A2925' }}>
          사업자등록 증명 API (데모)
        </h1>
        <p style={{ fontSize: 13, color: '#8A8A85', margin: '0 0 24px' }}>
          본인 정보로 직접 테스트해보는 화면입니다. 실제 고객 화면이 아닙니다.
        </p>

        <div style={{ background: '#fff', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="고객 ID (선택 — 입력하면 성공 시 그 고객 파일함에 PDF가 저장됩니다)">
            <input value={form.customerId} onChange={(e) => update('customerId', e.target.value)} placeholder="비워두면 저장 없이 결과만 표시" style={inputStyle} />
          </Field>
          <Field label="이름">
            <input value={form.userName} onChange={(e) => update('userName', e.target.value)} style={inputStyle} />
          </Field>
          <Field label="주민등록번호 (13자리)">
            <input value={form.residentNo} onChange={(e) => update('residentNo', e.target.value)} placeholder="900101-1234567" style={inputStyle} />
          </Field>
          <Field label="휴대폰 번호">
            <input value={form.phoneNo} onChange={(e) => update('phoneNo', e.target.value)} placeholder="01012345678" style={inputStyle} />
          </Field>
          <Field label="인증 방식">
            <select value={form.loginTypeLevel} onChange={(e) => update('loginTypeLevel', e.target.value)} style={inputStyle}>
              {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </Field>
          {form.loginTypeLevel === '5' && (
            <Field label="통신사 (PASS)">
              <select value={form.telecom} onChange={(e) => update('telecom', e.target.value)} style={inputStyle}>
                <option value="0">SKT</option>
                <option value="1">KT</option>
                <option value="2">LG U+</option>
              </select>
            </Field>
          )}

          <button
            onClick={requestAuth}
            disabled={status === 'requesting' || status === 'confirming'}
            style={btnStyle}
          >
            {status === 'requesting' ? '요청 중...' : '인증 요청'}
          </button>

          {status === 'pending' && (
            <button onClick={confirmAuth} disabled={status === 'confirming'} style={{ ...btnStyle, background: '#2A7D46' }}>
              인증 완료했어요 (확인)
            </button>
          )}

          {message && (
            <p style={{ fontSize: 13, color: status === 'error' ? '#C0392B' : '#2A2925', margin: 0 }}>{message}</p>
          )}
        </div>

        {items.length > 0 && (
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.map((item, i) => (
              <DocCard key={i} item={item} saved={savedFiles.some((f) => f.file_name?.includes(item.resCompanyNm || ''))} />
            ))}
          </div>
        )}

        {raw && (
          <div style={{ marginTop: 16 }}>
            <button
              onClick={() => setShowRaw((v) => !v)}
              style={{ background: 'none', border: 'none', color: '#8A8A85', fontSize: 12, cursor: 'pointer', padding: 0 }}
            >
              {showRaw ? '▲ 원본 JSON 접기' : '▼ 원본 JSON 보기 (디버깅용)'}
            </button>
            {showRaw && (
              <pre style={{
                marginTop: 8, background: '#1e1e1e', color: '#d4d4d4', padding: 16, borderRadius: 8,
                fontSize: 12, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              }}>
                {JSON.stringify(raw, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DocCard({ item, saved }) {
  const fmtDate = (d) => (d && d.length === 8 ? `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}` : d);
  const rows = [
    ['사업자등록번호', item.resCompanyIdentityNo],
    ['대표자', item.resUserNm],
    ['주소', item.resUserAddr?.replaceAll('+', ' ')],
    ['업태 / 종목', [item.resBusinessTypes, item.resBusinessItems].filter(Boolean).join(' / ').replaceAll('+', ' ')],
    ['개업일 / 등록일', [fmtDate(item.resOpenDate), fmtDate(item.resRegisterDate)].filter(Boolean).join(' / ')],
    ['발급기관', item.resIssueOgzNm],
    ['발급번호', item.resIssueNo],
  ].filter(([, v]) => v);

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #E0DFDA' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#2A2925' }}>
          {item.resCompanyNm || '상호 미확인'}
        </h3>
        {saved && (
          <span style={{ fontSize: 12, fontWeight: 600, color: '#2A7D46', background: '#EAF6EE', padding: '3px 8px', borderRadius: 20 }}>
            파일함 저장됨
          </span>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', rowGap: 6, columnGap: 8, fontSize: 13 }}>
        {rows.map(([label, value]) => (
          <React.Fragment key={label}>
            <span style={{ color: '#8A8A85' }}>{label}</span>
            <span style={{ color: '#2A2925' }}>{value}</span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#5A5952' }}>
      {label}
      {children}
    </label>
  );
}

const inputStyle = {
  padding: '10px 12px', borderRadius: 8, border: '1px solid #E0DFDA', fontSize: 14,
};

const btnStyle = {
  marginTop: 8, padding: '12px 16px', borderRadius: 8, border: 'none',
  background: '#2A2925', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
};
