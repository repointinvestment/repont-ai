'use client';

// app/admin/codef-test/page.jsx
// CODEF 데모 버전 연동 테스트용 화면 (admin 전용).
// "발급 서류" 드롭다운으로 문서 종류를 고르면 그 문서 전용 API 라우트(예: /api/codef/business-registration,
// /api/codef/additional-tax-standard)로 요청 → 승인 대기 → 확인, 2단계로 동작.
// 실제 서비스에 노출되는 화면이 아니라 CODEF 쪽에 전달할 테스트 검증용.
// 새 문서를 추가할 땐 DOCUMENTS 배열에 항목 하나, 그 문서 전용 API 라우트 두 개(요청/확인)만 추가하면 됨.

import { useEffect, useState } from 'react';
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

// 문서 종류별 설정. requestPath/confirmPath만 다르고 나머지 흐름은 공용.
// memberOnly: 비회원 간편인증(loginType 6) 미지원 — 고객이 홈택스 회원이어야 함을 화면에 안내.
const DOCUMENTS = {
  'corporate-registration': {
    label: '사업자등록 증명',
    requestPath: '/api/codef/business-registration',
    confirmPath: '/api/codef/business-registration/confirm',
    memberOnly: false,
    needsPeriod: false,
  },
  'additional-tax-standard': {
    label: '부가세과세표준증명',
    requestPath: '/api/codef/additional-tax-standard',
    confirmPath: '/api/codef/additional-tax-standard/confirm',
    memberOnly: true,
    needsPeriod: true,
  },
};

export default function CodefTestPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [docType, setDocType] = useState('corporate-registration');
  const [form, setForm] = useState({
    customerId: '', userName: '', residentNo: '', phoneNo: '', loginTypeLevel: '1', telecom: '0',
    startDate: '', endDate: '',
  });
  const [customers, setCustomers] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [status, setStatus] = useState(''); // '', 'requesting', 'pending', 'confirming', 'done', 'error'
  const [message, setMessage] = useState('');
  const [items, setItems] = useState([]);
  const [savedFiles, setSavedFiles] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    const s = getSession();
    if (!s) { router.push('/'); return; }
    if (s.role !== 'admin') { router.push('/menu'); return; }
    setUser(s);
    fetch('/api/customers', { headers: { 'x-consultant-id': s.username, 'x-consultant-role': s.role } })
      .then((r) => r.json())
      .then((d) => setCustomers(d.customers || []))
      .catch(() => {});
  }, []);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function resetResult() {
    setStatus('');
    setMessage('');
    setItems([]);
    setSavedFiles([]);
    setSessionId(null);
  }

  async function requestAuth() {
    setStatus('requesting');
    setMessage('');
    setItems([]);
    setSavedFiles([]);
    const doc = DOCUMENTS[docType];
    try {
      const res = await fetch(doc.requestPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-consultant-id': user.username },
        body: JSON.stringify(form),
      });
      const data = await res.json();
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
        finishWithResult(data);
      }
    } catch (err) {
      setStatus('error');
      setMessage(err.message);
    }
  }

  async function confirmAuth() {
    if (!sessionId) return;
    setStatus('confirming');
    const doc = DOCUMENTS[docType];
    try {
      const res = await fetch(doc.confirmPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus('error');
        setMessage(data.error || '확인 실패');
        return;
      }
      if (data.status === 'pending_2way') {
        setStatus('pending');
        setMessage('한 번 더 추가 인증이 필요합니다. 인증 앱을 확인하고 다시 확인 버튼을 눌러주세요.');
      } else {
        finishWithResult(data);
      }
    } catch (err) {
      setStatus('error');
      setMessage(err.message);
    }
  }

  function finishWithResult(data) {
    if (data.status !== 'done') {
      setStatus('error');
      setMessage(data.result?.result?.message || '실패');
      return;
    }
    const docs = Array.isArray(data.result?.data) ? data.result.data : data.result?.data ? [data.result.data] : [];
    setItems(docs);
    setSavedFiles(data.savedFiles || []);
    setSelectedIdx(0);
    setStatus('done');
    setMessage(
      data.savedFiles?.length > 0
        ? `발급 성공! 고객 파일함에 ${data.savedFiles.length}건 저장했습니다.`
        : '발급 성공! (고객을 선택하지 않아 파일함에는 저장하지 않았습니다)'
    );
  }

  if (!user) return null;

  const doc = DOCUMENTS[docType];
  const selectedItem = items[selectedIdx];
  const selectedFile = selectedItem
    ? savedFiles.find((f) => f.companyName && f.companyName === selectedItem.resCompanyNm)
    : null;

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <AppHeader user={user} />
      <div style={{ padding: '32px 40px', maxWidth: 640, margin: '0 auto' }}>
        <p style={{ fontSize: 13, color: '#8A8A85', margin: '0 0 4px' }}>CODEF 연동 테스트</p>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 6px', color: '#2A2925' }}>
          국세청 증명서 발급 (데모)
        </h1>
        <p style={{ fontSize: 13, color: '#8A8A85', margin: '0 0 24px' }}>
          본인 정보로 직접 테스트해보는 화면입니다. 실제 고객 화면이 아닙니다.
        </p>

        <div style={{ background: '#fff', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="발급 서류">
            <select
              value={docType}
              onChange={(e) => { setDocType(e.target.value); resetResult(); }}
              style={inputStyle}
            >
              {Object.entries(DOCUMENTS).map(([key, d]) => (
                <option key={key} value={key}>{d.label}</option>
              ))}
            </select>
          </Field>
          {doc.memberOnly && (
            <p style={{ fontSize: 12, color: '#8A8A85', margin: '-4px 0 0' }}>
              ※ 이 서류는 비회원 간편인증을 지원하지 않아, 고객이 홈택스 회원가입이 되어있어야 발급됩니다.
            </p>
          )}

          <Field label="고객 선택 (선택 — 고르면 성공 시 그 고객 파일함에 PDF가 저장됩니다)">
            <select value={form.customerId} onChange={(e) => update('customerId', e.target.value)} style={inputStyle}>
              <option value="">저장 없이 결과만 표시</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.owner_name || '이름 미입력'}{c.business_name ? ` · ${c.business_name}` : ''}
                </option>
              ))}
            </select>
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
          {doc.needsPeriod && (
            <Field label="과세기간 (비워두면 가장 최근 완료된 기간으로 자동 조회)">
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={form.startDate} onChange={(e) => update('startDate', e.target.value)} placeholder="시작 YYYYMM" style={{ ...inputStyle, flex: 1 }} />
                <input value={form.endDate} onChange={(e) => update('endDate', e.target.value)} placeholder="종료 YYYYMM" style={{ ...inputStyle, flex: 1 }} />
              </div>
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

          {message && status !== 'confirming' && (
            <p style={{ fontSize: 13, color: status === 'error' ? '#C0392B' : '#2A2925', margin: 0 }}>{message}</p>
          )}
        </div>

        {(status === 'requesting' || status === 'confirming') && (
          <LoadingModal
            messages={
              status === 'requesting'
                ? ['카카오톡 인증을 요청하고 있습니다', '고객님의 승인을 기다리고 있습니다']
                : ['고객님의 서류를 준비하고 있습니다', '국세청 홈택스에 접속하고 있습니다', '전자서명을 확인하고 있습니다', '증명서를 발급하고 있습니다']
            }
          />
        )}

        {items.length > 0 && (
          <div style={{ marginTop: 20 }}>
            {items.length > 1 && (
              <select
                value={selectedIdx}
                onChange={(e) => setSelectedIdx(Number(e.target.value))}
                style={{ ...inputStyle, width: '100%', marginBottom: 12, background: '#fff' }}
              >
                {items.map((it, i) => (
                  <option key={i} value={i}>{it.resCompanyNm || `사업장 ${i + 1}`}</option>
                ))}
              </select>
            )}
            {selectedItem && (
              <DocCard docType={docType} item={selectedItem} file={selectedFile} customerId={form.customerId} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingModal({ messages = [
  '고객님의 서류를 준비하고 있습니다',
  '국세청 홈택스에 접속하고 있습니다',
  '전자서명을 확인하고 있습니다',
  '증명서를 발급하고 있습니다',
] }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPhase((p) => (p + 1) % messages.length), 2200);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(20, 20, 18, 0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: '40px 48px', width: 360,
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#8A8A85', letterSpacing: 1, margin: '0 0 24px' }}>
          자금비서
        </p>

        <div style={{ position: 'relative', width: 220, height: 110, marginBottom: 24 }}>
          <FolderIcon style={{ position: 'absolute', left: 0, bottom: 0 }} />
          <FolderIcon style={{ position: 'absolute', right: 0, bottom: 0 }} />
          <div style={{ position: 'absolute', left: 44, bottom: 40, animation: 'codef-fly 1.8s ease-in-out infinite' }}>
            <PaperIcon />
          </div>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{
              position: 'absolute', top: 6, left: 90 + i * 14, width: 5, height: 5, borderRadius: '50%',
              background: '#B8C9E8', animation: `codef-blip 1.4s ease-in-out ${i * 0.18}s infinite`,
            }} />
          ))}
        </div>

        <p style={{ fontSize: 15, fontWeight: 700, color: '#2A2925', margin: '0 0 6px' }}>
          잠시만 기다려 주세요
        </p>
        <p key={phase} style={{ fontSize: 13, color: '#8A8A85', margin: 0, animation: 'codef-fade 0.4s ease' }}>
          {messages[phase]}
        </p>

        <style>{`
          @keyframes codef-fly {
            0%   { transform: translateX(0) translateY(0) rotate(0deg); opacity: 0; }
            15%  { opacity: 1; }
            50%  { transform: translateX(66px) translateY(-26px) rotate(6deg); opacity: 1; }
            85%  { opacity: 1; }
            100% { transform: translateX(132px) translateY(0) rotate(0deg); opacity: 0; }
          }
          @keyframes codef-blip {
            0%, 100% { transform: translateY(0); opacity: 0.2; }
            50% { transform: translateY(10px); opacity: 1; }
          }
          @keyframes codef-fade {
            from { opacity: 0; transform: translateY(3px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    </div>
  );
}

function FolderIcon({ style }) {
  return (
    <svg width="60" height="46" viewBox="0 0 60 46" style={style}>
      <path d="M2 10c0-2.2 1.8-4 4-4h14l5 5h29c2.2 0 4 1.8 4 4v27c0 2.2-1.8 4-4 4H6c-2.2 0-4-1.8-4-4V10z" fill="#3B6BC7" />
      <path d="M2 16h56v22c0 2.2-1.8 4-4 4H6c-2.2 0-4-1.8-4-4V16z" fill="#4C7FE0" />
    </svg>
  );
}

function PaperIcon() {
  return (
    <svg width="30" height="36" viewBox="0 0 30 36">
      <rect x="1" y="1" width="28" height="34" rx="2" fill="#fff" stroke="#D8DEE9" strokeWidth="1.5" />
      <line x1="6" y1="9" x2="24" y2="9" stroke="#C7CEDB" strokeWidth="1.5" />
      <line x1="6" y1="15" x2="24" y2="15" stroke="#C7CEDB" strokeWidth="1.5" />
      <line x1="6" y1="21" x2="18" y2="21" stroke="#C7CEDB" strokeWidth="1.5" />
    </svg>
  );
}

// 문서 종류별로 카드에 보여줄 필드 구성. 새 문서 추가 시 여기에 한 항목만 더 추가하면 됨.
function buildRows(docType, item) {
  const fmtDate = (d) => (d && d.length === 8 ? `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}` : d);
  const fmtPeriod = (d) => (d && d.length === 8 ? `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}` : d);
  const fmtAmt = (n) => (n ? `${Number(n).toLocaleString('ko-KR')}원` : n);

  if (docType === 'additional-tax-standard') {
    return [
      ['사업자등록번호', item.resCompanyIdentityNo],
      ['대표자', item.resUserNm],
      ['주소', item.resUserAddr?.replaceAll('+', ' ')],
      ['업태 / 종목', [item.resBusinessTypes, item.resBusinessItems].filter(Boolean).join(' / ').replaceAll('+', ' ')],
      ['과세기간', [fmtPeriod(item.commStartDate), fmtPeriod(item.commEndDate)].filter(Boolean).join(' ~ ')],
      ['과세 총금액', fmtAmt(item.resIncomeTotalAmt)],
      ['소득금액(과세대상급여액)', fmtAmt(item.resIncomeAmt)],
      ['면세 금액', fmtAmt(item.resDutyFreeAmt)],
      ['세액', fmtAmt(item.resTaxAmt)],
      ['발급기관', item.resIssueOgzNm],
      ['발급번호', item.resIssueNo],
    ].filter(([, v]) => v);
  }

  // 기본값: 사업자등록 증명
  return [
    ['사업자등록번호', item.resCompanyIdentityNo],
    ['대표자', item.resUserNm],
    ['주소', item.resUserAddr?.replaceAll('+', ' ')],
    ['업태 / 종목', [item.resBusinessTypes, item.resBusinessItems].filter(Boolean).join(' / ').replaceAll('+', ' ')],
    ['개업일 / 등록일', [fmtDate(item.resOpenDate), fmtDate(item.resRegisterDate)].filter(Boolean).join(' / ')],
    ['발급기관', item.resIssueOgzNm],
    ['발급번호', item.resIssueNo],
  ].filter(([, v]) => v);
}

function DocCard({ docType, item, file, customerId }) {
  const rows = buildRows(docType, item);
  const doc = DOCUMENTS[docType];
  const serverDownloadUrl = file && customerId ? `/api/customers/${customerId}/files/${file.id}/download` : null;

  // CODEF가 준 PDF 원문(Base64)을 우리 서버에 저장하지 않고, 컨설턴트 브라우저에서 바로 파일로 내려받게 함.
  // 파일함 저장 여부(고객 선택 여부)와 무관하게 항상 가능.
  function downloadLocal() {
    const base64 = item.resOriGinalData1
    if (!base64) return
    const byteChars = atob(base64)
    const bytes = new Uint8Array(byteChars.length)
    for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
    const blob = new Blob([bytes], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${doc.label}_${(item.resCompanyNm || '문서').replace(/[/\\?%*:|"<>]/g, '')}_${item.resIssueDate || ''}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #E0DFDA' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#2A2925' }}>
          {item.resCompanyNm || '상호 미확인'}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!serverDownloadUrl && (
            <span style={{ fontSize: 12, color: '#B0AFA9', whiteSpace: 'nowrap' }}>고객 미선택 — 파일함 저장 안 됨</span>
          )}
          {item.resOriGinalData1 && (
            <button
              onClick={downloadLocal}
              style={{
                fontSize: 12, fontWeight: 600, color: '#fff', background: '#2A2925', border: 'none', cursor: 'pointer',
                padding: '5px 10px', borderRadius: 20, whiteSpace: 'nowrap',
              }}
            >
              PDF 다운로드
            </button>
          )}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', rowGap: 6, columnGap: 8, fontSize: 13 }}>
        {rows.map(([label, value]) => (
          <div key={label} style={{ display: 'contents' }}>
            <span style={{ color: '#8A8A85' }}>{label}</span>
            <span style={{ color: '#2A2925' }}>{value}</span>
          </div>
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
