'use client';

// app/components/CodefDocumentIssuance.jsx
// CODEF로 국세청 증명서(사업자등록증명, 부가세과세표준증명 등)를 발급받는 공용 UI.
// 두 곳에서 씀:
//   - /admin/codef-test: 아무 정보나 넣어 자유롭게 테스트 (customerId는 드롭다운으로 선택, 없으면 미저장)
//   - /customers/[id]: 그 고객 화면에 내장 — customerId/이름/전화번호가 이미 정해져 있어 바로 발급 가능
// 새 문서(예: 소득금액증명원)를 추가할 땐 DOCUMENTS 객체에 항목 하나, 그 문서 전용 API 라우트 두 개만 추가하면 됨.

import { useEffect, useRef, useState } from 'react';

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

// 부가세과세표준증명은 "몇 년도 몇 기(반기)" 증명서를 뗄지 고르는 것뿐, 창업 월과는 무관함.
// 최근 3년 x 1기/2기를 최신순으로 나열 — 미래이거나 아직 신고기한이 안 지난 기간은 제외.
function buildVatPeriodOptions() {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const options = []
  for (let year = y; year >= y - 3; year--) {
    // 2기(7~12월, 신고기한 다음해 1/25)
    if (year < y || m >= 8) options.push({ year, half: 2, label: `${year}년 2기 (7~12월)`, startDate: `${year}07`, endDate: `${year}12` })
    // 1기(1~6월, 신고기한 7/25)
    if (year < y || m >= 2) options.push({ year, half: 1, label: `${year}년 1기 (1~6월)`, startDate: `${year}01`, endDate: `${year}06` })
  }
  return options.filter((o) => `${o.year}${String(o.half === 1 ? '06' : '12')}` <= `${y}${String(m).padStart(2, '0')}`)
}

// 가장 최근 신고기한이 지난(=완료된) 반기를 계산.
function latestCompletedHalf() {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  if (m >= 8) return { year: y, half: 1, endDate: `${y}06`, label: `${y}년 1기` }
  return { year: y - 1, half: 2, endDate: `${y - 1}12`, label: `${y - 1}년 2기` }
}

// "최근 N년" 범위 프리셋 — CODEF에 넓은 startDate~endDate를 주면 그 안의 반기별 증명서를
// 배열로 한 번에 돌려주므로(출력부 "반복부"), 매출 추이를 보려면 이 범위로 조회해야 함.
// 최대 5년까지 지원(CODEF 문서 기준: 1분기는 5년전, 그 외 4년전까지 조회 가능).
function buildVatRangeOptions() {
  const latest = latestCompletedHalf()
  return [1, 2, 3, 5].map((n) => ({
    label: `최근 ${n}년 (${latest.year - (n - 1)}년 1기 ~ ${latest.label})`,
    startDate: `${latest.year - (n - 1)}01`,
    endDate: latest.endDate,
  }))
}


export const DOCUMENTS = {
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
  'tax-payment-certificate': {
    label: '납세증명서 (국세완납증명)',
    requestPath: '/api/codef/tax-payment-certificate',
    confirmPath: '/api/codef/tax-payment-certificate/confirm',
    memberOnly: false,
    needsPeriod: false,
  },
  'financial-statement': {
    label: '재무제표',
    requestPath: '/api/codef/financial-statement',
    confirmPath: '/api/codef/financial-statement/confirm',
    memberOnly: false,
    needsPeriod: false,
    needsAttrYear: true, // 재무제표 전용 — 사업자 유형 + 귀속연도(법인은 종료월까지) 입력 필요
  },
  'localtax-payment-certificate': {
    label: '지방세 납세증명서',
    requestPath: '/api/codef/localtax-payment-certificate',
    confirmPath: '/api/codef/localtax-payment-certificate/confirm',
    memberOnly: false,
    needsPeriod: false,
    needsAddress: true, // 주소(도로명주소) 입력 필요
    soloOnly: true,      // CODEF 스펙: loginType=6(비회원 간편인증) 다건요청 불가 — 항상 단독 조회
  },
};

// 재무제표 귀속연도 — 종합소득세 신고기한(5/31, 성실신고확인대상자는 6/30) 지난 뒤부터
// 그 해 재무제표가 나온다고 보고, 여유 두고 7월 이후면 올해분까지 완료된 것으로 간주.
function latestAttrYear() {
  const now = new Date()
  const y = now.getFullYear()
  return now.getMonth() + 1 >= 7 ? y - 1 : y - 2
}
function buildAttrYearOptions() {
  const latest = latestAttrYear()
  return [latest, latest - 1, latest - 2, latest - 3]
}
// "최근 N년" 한 번에 — CODEF 재무제표 API는 한 번 호출에 연도 하나만 주기 때문에(부가세과세표준증명과
// 달리 기간 범위를 안 받음), 연도별로 요청을 N번 나눠 보내되 다건요청(SSO id) 메커니즘으로 묶어서
// 카카오 인증은 한 번만 타도록 처리함(자세한 건 buildRequestUnits 참고).
function buildAttrYearRange(n) {
  const latest = latestAttrYear()
  return Array.from({ length: n }, (_, i) => latest - i)
}

// props:
//   customerId, consultantUsername (필수)
//   customerPicker: true면 화면 안에서 고객을 고를 수 있는 드롭다운을 보여줌 (관리자 테스트/서류발급 화면용)
//   customers: customerPicker=true일 때 목록
//   defaultUserName, defaultPhoneNo: 미리 채워둘 값 (고객 상세 페이지에서 넘겨줌)
//   onSaved: 발급 성공 + 파일함 저장까지 끝났을 때 호출 (파일 목록 새로고침용)
export default function CodefDocumentIssuance({
  consultantUsername,
  customerId: fixedCustomerId,
  customerPicker = false,
  customers = [],
  defaultUserName = '',
  defaultPhoneNo = '',
  onSaved,
}) {
  // 일괄 발급: 체크한 문서를 전부 동시에(병렬로) 요청 — CODEF 다건요청(SSO id) 가이드에 따르면
  // 같은 id로 여러 요청을 "동시에" 보내야 하나의 로그인 세션(카카오 승인 1번)으로 묶임.
  // (전에 하나씩 순서대로 보냈을 땐 매번 새 로그인으로 취급돼 승인이 각각 필요했음)
  const [selectedDocs, setSelectedDocs] = useState(['corporate-registration']);
  const [form, setForm] = useState({
    customerId: fixedCustomerId || '',
    userName: defaultUserName,
    residentNo: '',
    phoneNo: defaultPhoneNo,
    loginTypeLevel: '1',
    telecom: '0',
    startDate: '',
    endDate: '',
    businessType: 'individual', // 재무제표용 — 'individual' | 'corporate'
    attrYearMode: 'single',     // 재무제표용 — 'single'(귀속연도 1개) | 'range'(최근 N년)
    attrYear: '',               // 재무제표용 귀속연도 단건 (비우면 서버가 자동 계산)
    attrYearRangeCount: '3',    // 재무제표용 — attrYearMode='range'일 때 최근 몇 년
    attrMonth: '12',            // 재무제표용 — 법인일 때만 사용, 사업연도 종료월
    address: '',                // 지방세 납세증명서용 — 도로명주소 (필수)
    addrDetail: '',             // 지방세 납세증명서용 — 상세주소 (동/호수 등, 선택)
  });
  // docKey별 진행 상태를 각각 들고 있음: { status: 'idle'|'requesting'|'pending'|'done'|'error', sessionId, items, savedFiles, message }
  const [docStates, setDocStates] = useState({});
  const [phase, setPhase] = useState(''); // '', 'requesting', 'pending', 'confirming', 'done', 'error'
  const [selectedIdx, setSelectedIdx] = useState({}); // { [docKey]: 사업장 인덱스 } — 문서별 다건일 때
  // CODEF 다건요청 방식: 맨 처음 문서(리더)만 실제 카카오 인증을 타고, 나머지(팔로워)는 리더와 거의 동시에
  // (0.5~1초 간격) 미리 요청을 걸어둔 채 CODEF 서버가 응답을 붙잡고 있다가, 리더가 승인되는 순간
  // 같은 로그인 세션으로 자동 처리되어 응답이 옴. 그 "아직 안 끝난 요청"들을 여기 보관해뒀다가
  // 확인 버튼 누를 때 같이 기다림.
  const followerPromisesRef = useRef({});

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleDoc(key) {
    setSelectedDocs((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      // 단독조회 전용 문서(soloOnly)는 다건요청이 안 돼서 다른 선택과 함께 못 감 —
      // 선택하면 나머지는 다 비우고, 반대로 단독조회 문서가 이미 있는 상태에서 다른 걸 고르면 그건 뺌.
      if (DOCUMENTS[key].soloOnly) return [key];
      return [...prev.filter((k) => !DOCUMENTS[k].soloOnly), key];
    });
    setDocStates({});
    setPhase('');
    followerPromisesRef.current = {};
  }

  // 모든 선택 문서 지원 여부를 보고 로그인 방식 통일 — 전부 비회원 가능하면 6, 하나라도 회원전용 있으면 5로 통일
  // (같은 로그인 세션으로 묶이려면 로그인 방식 자체가 같아야 함)
  function pickLoginType() {
    return selectedDocs.every((k) => !DOCUMENTS[k].memberOnly) ? '6' : '5';
  }

  // 선택된 문서들을 실제로 쏠 "요청 단위" 목록으로 펼침. 보통은 문서 하나 = 요청 하나지만,
  // 재무제표를 "최근 N년" 모드로 선택하면 연도별로 요청을 N개로 나눔 — CODEF 재무제표 API가
  // 한 번에 연도 하나만 받기 때문(부가세과세표준증명처럼 기간 범위를 한 번에 안 줌).
  // 나뉜 요청들도 전부 같은 sharedId로 묶어서 리더/팔로워 체인에 태우면 카카오 인증은 한 번만 필요함.
  function buildRequestUnits() {
    const units = [];
    for (const docKey of selectedDocs) {
      if (docKey === 'financial-statement' && form.attrYearMode === 'range') {
        const years = buildAttrYearRange(Number(form.attrYearRangeCount) || 3);
        for (const y of years) {
          units.push({ unitKey: `financial-statement::${y}`, docKey, extra: { attrYear: String(y) } });
        }
      } else {
        units.push({ unitKey: docKey, docKey, extra: {} });
      }
    }
    return units;
  }

  function fireRequest(unit, sid, loginType) {
    const doc = DOCUMENTS[unit.docKey];
    return fetch(doc.requestPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-consultant-id': consultantUsername || '' },
      body: JSON.stringify({ ...form, ...unit.extra, sharedId: sid, loginType }),
    }).then(async (res) => {
      const data = await res.json();
      return { key: unit.unitKey, docKey: unit.docKey, ok: res.ok, data };
    }).catch((err) => ({ key: unit.unitKey, docKey: unit.docKey, ok: false, data: { error: err.message } }));
  }

  async function startBatch() {
    if (selectedDocs.length === 0) return;
    setPhase('requesting');
    const sid = `batch-${form.customerId || 'test'}-${Date.now()}`;
    const loginType = pickLoginType();
    const units = buildRequestUnits();
    const [leaderUnit, ...followerUnits] = units;

    setDocStates(Object.fromEntries(units.map((u) => [u.unitKey, { status: 'requesting', docKey: u.docKey }])));
    followerPromisesRef.current = {};

    // 리더 먼저 보내고 응답(카카오 인증 트리거)을 기다림
    const leaderResponse = await fireRequest(leaderUnit, sid, loginType);

    // 팔로워는 0.5~1초 간격을 두고 순서대로 보내되, 응답은 기다리지 않고 나중에 한꺼번에 처리
    // (리더 인증이 완료되기 전까지 CODEF가 이 요청들의 응답을 붙잡고 있음)
    for (const unit of followerUnits) {
      await new Promise((r) => setTimeout(r, 700));
      followerPromisesRef.current[unit.unitKey] = fireRequest(unit, sid, loginType);
    }

    applyResponses([leaderResponse]);
  }

  async function confirmBatch() {
    setPhase('confirming');

    // 지금 'pending' 상태(=자기 sessionId로 확인이 필요한) 요청 단위들을 전부 확인 요청
    const pendingConfirms = Object.entries(docStates)
      .filter(([, s]) => s.status === 'pending')
      .map(([key, s]) => {
        const doc = DOCUMENTS[s.docKey];
        return fetch(doc.confirmPath, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: s.sessionId }),
        }).then(async (res) => {
          const data = await res.json();
          return { key, docKey: s.docKey, ok: res.ok, data };
        }).catch((err) => ({ key, docKey: s.docKey, ok: false, data: { error: err.message } }));
      });

    // 아직 첫 응답을 못 받은 팔로워들(리더 인증과 함께 자동으로 풀릴 요청들)도 같이 기다림
    const outstandingFollowers = Object.values(followerPromisesRef.current);
    followerPromisesRef.current = {};

    const responses = await Promise.all([...pendingConfirms, ...outstandingFollowers]);
    applyResponses(responses);
  }

  // 요청/확인 응답을 요청 단위별 상태에 반영하고, 남은 pending이 있는지에 따라 전체 phase를 정함.
  function applyResponses(responses) {
    setDocStates((prev) => {
      const next = { ...prev };
      let savedCount = 0;
      for (const { key, docKey, ok, data } of responses) {
        const resolvedDocKey = docKey || prev[key]?.docKey || key;
        if (!ok) {
          next[key] = { status: 'error', docKey: resolvedDocKey, message: data.error || '요청 실패' };
          continue;
        }
        if (data.status === 'pending_2way') {
          next[key] = { status: 'pending', docKey: resolvedDocKey, sessionId: data.sessionId, message: data.message || '' };
          continue;
        }
        if (data.status === 'done') {
          const items = Array.isArray(data.result?.data) ? data.result.data : data.result?.data ? [data.result.data] : [];
          next[key] = { status: 'done', docKey: resolvedDocKey, items, savedFiles: data.savedFiles || [] };
          savedCount += data.savedFiles?.length || 0;
          continue;
        }
        next[key] = { status: 'error', docKey: resolvedDocKey, message: data.result?.result?.message || '실패' };
      }
      if (savedCount > 0 && onSaved) onSaved();

      const values = Object.values(next);
      const stillPending = values.some((s) => s.status === 'pending');
      const anyError = values.some((s) => s.status === 'error');
      setPhase(stillPending ? 'pending' : (anyError ? 'error' : 'done'));
      if (!stillPending) {
        setSelectedIdx(Object.fromEntries(selectedDocs.map((k) => [k, 0])));
      }
      return next;
    });
  }

  const anyMemberOnly = selectedDocs.some((k) => DOCUMENTS[k].memberOnly);
  const anyNeedsPeriod = selectedDocs.some((k) => DOCUMENTS[k].needsPeriod);
  const anyNeedsAttrYear = selectedDocs.some((k) => DOCUMENTS[k].needsAttrYear);
  const anyNeedsAddress = selectedDocs.some((k) => DOCUMENTS[k].needsAddress);
  const hasSoloDoc = selectedDocs.some((k) => DOCUMENTS[k].soloOnly);
  const doneCount = Object.values(docStates).filter((s) => s.status === 'done').length;
  const errorEntries = Object.entries(docStates).filter(([, s]) => s.status === 'error');
  const savedTotal = Object.values(docStates).reduce((sum, s) => sum + (s.savedFiles?.length || 0), 0);

  // 재무제표는 간편장부대상자이거나 업력이 짧으면 국세청에 원본이 없어 CODEF가 에러로 응답함 —
  // 실제 오류가 아니라 정상적인 "없음" 상태라, CODEF 원문 메시지(문구도 딱딱하고 공백이 '+'로 깨져서 옴) 대신
  // 짧은 안내문 하나로 대체해서 보여줌. 재무제표를 "최근 N년"으로 조회해 여러 건이 동시에 실패해도 중복 없이 한 줄만.
  const FS_KEY = 'financial-statement';
  const hasFsError = errorEntries.some(([, s]) => s.docKey === FS_KEY);
  const FS_HINT = '간편장부대상자이거나 업력이 짧아 아직 신고 전일 수 있습니다.';

  let summaryMessage = '';
  const unitsCount = Object.keys(docStates).length;
  if (phase === 'done') {
    summaryMessage = errorEntries.length > 0
      ? `${doneCount}/${unitsCount}건 완료. 실패: ${[...new Set(errorEntries.map(([, s]) => DOCUMENTS[s.docKey].label))].join(', ')}${hasFsError ? ` (재무제표: ${FS_HINT})` : ''}`
      : savedTotal > 0
        ? `${unitsCount}개 서류 발급 완료! 파일함에 총 ${savedTotal}건 저장했습니다.`
        : `${unitsCount}개 서류 발급 완료! (고객을 선택하지 않아 파일함에는 저장하지 않았습니다)`;
  } else if (phase === 'pending') {
    const pendingLabels = Object.entries(docStates).filter(([, s]) => s.status === 'pending').map(([, s]) => DOCUMENTS[s.docKey].label);
    summaryMessage = `카카오톡에서 인증을 승인한 뒤 확인 버튼을 눌러주세요. (${pendingLabels.join(', ')})`;
  } else if (phase === 'error' && errorEntries.length > 0) {
    const otherMsgs = errorEntries
      .filter(([, s]) => s.docKey !== FS_KEY)
      .map(([, s]) => `[${DOCUMENTS[s.docKey].label}] ${(s.message || '').replaceAll('+', ' ')}`);
    const fsMsg = hasFsError ? [`[재무제표] ${FS_HINT}`] : [];
    summaryMessage = [...otherMsgs, ...fsMsg].join(' / ');
  }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label="발급 서류 (여러 개 선택 가능 — 인증 한 번으로 함께 발급을 시도합니다)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, border: '1px solid #E0DFDA', borderRadius: 8, padding: 12 }}>
            {Object.entries(DOCUMENTS).map(([key, d]) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selectedDocs.includes(key)}
                  onChange={() => toggleDoc(key)}
                />
                {d.label}
              </label>
            ))}
          </div>
        </Field>
        {(anyMemberOnly || selectedDocs.length > 1 || hasSoloDoc) && (
          <p style={{ fontSize: 12, color: '#8A8A85', margin: '-4px 0 0' }}>
            ※ {hasSoloDoc
              ? '이 서류는 다른 서류와 함께 조회할 수 없어(CODEF 다건요청 미지원) 단독으로만 진행됩니다.'
              : selectedDocs.length > 1
                ? `여러 서류를 함께 받을 땐 로그인 방식을 ${pickLoginType() === '6' ? '비회원' : '회원'} 간편인증으로 통일해서 진행합니다.${pickLoginType() === '5' ? ' 고객이 홈택스 회원가입이 되어있어야 합니다.' : ''}`
                : '이 서류는 비회원 간편인증을 지원하지 않아, 고객이 홈택스 회원가입이 되어있어야 발급됩니다.'}
          </p>
        )}

        {customerPicker && (
          <Field label="고객 선택 (선택 — 고르면 성공 시 그 고객 파일함에 저장됩니다)">
            <select value={form.customerId} onChange={(e) => update('customerId', e.target.value)} style={inputStyle}>
              <option value="">저장 없이 결과만 표시</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.owner_name || '이름 미입력'}{c.business_name ? ` · ${c.business_name}` : ''}
                </option>
              ))}
            </select>
          </Field>
        )}
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
        {anyNeedsPeriod && (
          <Field label="과세기간 (부가세과세표준증명용 — 여러 해를 선택하면 반기별로 여러 장 발급됩니다)">
            <select
              value={form.startDate && form.endDate ? `${form.startDate}-${form.endDate}` : ''}
              onChange={(e) => {
                if (!e.target.value) { update('startDate', ''); update('endDate', ''); return; }
                const [s, en] = e.target.value.split('-');
                setForm((f) => ({ ...f, startDate: s, endDate: en }));
              }}
              style={inputStyle}
            >
              <option value="">자동 (최근 완료된 반기 1건)</option>
              <optgroup label="여러 해 한 번에 (매출 추이 확인용)">
                {buildVatRangeOptions().map((o) => (
                  <option key={o.label} value={`${o.startDate}-${o.endDate}`}>{o.label}</option>
                ))}
              </optgroup>
              <optgroup label="특정 반기 1건만">
                {buildVatPeriodOptions().map((o) => (
                  <option key={o.label} value={`${o.startDate}-${o.endDate}`}>{o.label}</option>
                ))}
              </optgroup>
            </select>
          </Field>
        )}

        {anyNeedsAttrYear && (
          <>
            <Field label="사업자 유형 (재무제표용)">
              <select value={form.businessType} onChange={(e) => update('businessType', e.target.value)} style={inputStyle}>
                <option value="individual">개인사업자</option>
                <option value="corporate">법인사업자</option>
              </select>
            </Field>
            <Field label="조회 방식 (재무제표용)">
              <select value={form.attrYearMode} onChange={(e) => update('attrYearMode', e.target.value)} style={inputStyle}>
                <option value="single">특정 연도 1건만</option>
                <option value="range">최근 N년 한 번에 (인증은 1번만)</option>
              </select>
            </Field>
            {form.attrYearMode === 'range' ? (
              <Field label="최근 몇 년 (재무제표용)">
                <select value={form.attrYearRangeCount} onChange={(e) => update('attrYearRangeCount', e.target.value)} style={inputStyle}>
                  {[2, 3, 5].map((n) => {
                    const years = buildAttrYearRange(n);
                    return (
                      <option key={n} value={n}>
                        최근 {n}년 ({years[years.length - 1]}년 ~ {years[0]}년)
                      </option>
                    );
                  })}
                </select>
              </Field>
            ) : (
              <Field label="귀속연도 (재무제표용)">
                <select value={form.attrYear} onChange={(e) => update('attrYear', e.target.value)} style={inputStyle}>
                  <option value="">자동 (최근 신고 완료된 연도)</option>
                  {buildAttrYearOptions().map((y) => (
                    <option key={y} value={y}>{y}년</option>
                  ))}
                </select>
              </Field>
            )}
            {form.businessType === 'corporate' && (
              <Field label="사업연도 종료월 (법인만)">
                <select value={form.attrMonth} onChange={(e) => update('attrMonth', e.target.value)} style={inputStyle}>
                  {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((m) => (
                    <option key={m} value={m}>{m}월</option>
                  ))}
                </select>
              </Field>
            )}
          </>
        )}

        {anyNeedsAddress && (
          <>
            <Field label="주소 (지방세 납세증명서용 — 도로명주소)">
              <input
                value={form.address}
                onChange={(e) => update('address', e.target.value)}
                placeholder="예: 서울특별시 영등포구 여의대로 38"
                style={inputStyle}
              />
            </Field>
            <Field label="상세주소 (동/호수 등, 선택)">
              <input value={form.addrDetail} onChange={(e) => update('addrDetail', e.target.value)} style={inputStyle} />
            </Field>
          </>
        )}

        <button
          onClick={startBatch}
          disabled={selectedDocs.length === 0 || phase === 'requesting' || phase === 'confirming'}
          style={btnStyle}
        >
          {phase === 'requesting' ? '요청 중...' : `인증 요청 (${buildRequestUnits().length}건)`}
        </button>

        {phase === 'pending' && (
          <button onClick={confirmBatch} disabled={phase === 'confirming'} style={{ ...btnStyle, background: '#2A7D46' }}>
            인증 완료했어요 (확인)
          </button>
        )}

        {summaryMessage && phase !== 'confirming' && (
          <p style={{ fontSize: 13, color: phase === 'error' ? '#C0392B' : '#2A2925', margin: 0 }}>{summaryMessage}</p>
        )}
      </div>

      {(phase === 'requesting' || phase === 'confirming') && (
        <LoadingModal
          messages={
            phase === 'requesting'
              ? [unitsCount > 1 ? `${unitsCount}건 서류 인증을 함께 요청하고 있습니다` : '인증을 요청하고 있습니다', '고객님의 승인을 기다리고 있습니다']
              : ['서류를 준비하고 있습니다', '국세청 홈택스에 접속하고 있습니다', '전자서명을 확인하고 있습니다', '증명서를 발급하고 있습니다']
          }
        />
      )}

      {doneCount > 0 && (
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {selectedDocs.filter((docKey) =>
            Object.values(docStates).some((s) => s.docKey === docKey && s.status === 'done')
          ).map((docKey) => {
            const doneUnitStates = Object.values(docStates).filter((s) => s.docKey === docKey && s.status === 'done');
            const rawItems = doneUnitStates.flatMap((s) => s.items || []);
            const savedFiles = doneUnitStates.flatMap((s) => s.savedFiles || []);
            // 부가세과세표준증명은 반기별로 여러 건이 올 수 있는데, 회사가 같으면 한 줄로 합쳐서 보여줌
            // (기간은 조회된 것 중 가장 이른 시작 ~ 가장 늦은 끝, 금액은 합계).
            // 재무제표를 "최근 N년"으로 조회했을 땐 여러 요청 단위 결과를 모은 것이므로 연도 최신순 정렬.
            const items = docKey === 'additional-tax-standard'
              ? aggregateTaxStandard(rawItems)
              : docKey === 'financial-statement'
                ? [...rawItems].sort((a, b) => Number(b.resAttrYear || 0) - Number(a.resAttrYear || 0))
                : rawItems;

            const idx = selectedIdx[docKey] || 0;
            const item = items[idx];
            const itemPeriod = item?.commStartDate && item?.commEndDate ? `${item.commStartDate}-${item.commEndDate}` : '';
            const file = item
              ? savedFiles.find((f) => f.companyName === item.resCompanyNm && (f.period || '') === itemPeriod)
                || savedFiles.find((f) => f.companyName === item.resCompanyNm)
              : null;
            return (
              <div key={docKey}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#5A5952', margin: '0 0 8px' }}>{DOCUMENTS[docKey].label}</p>
                {items.length > 1 && (
                  <select
                    value={idx}
                    onChange={(e) => setSelectedIdx((prev) => ({ ...prev, [docKey]: Number(e.target.value) }))}
                    style={{ ...inputStyle, width: '100%', marginBottom: 10, background: '#fff' }}
                  >
                    {items.map((it, i) => {
                      const fmt = (d) => (d && d.length === 8 ? `${d.slice(0, 4)}.${d.slice(4, 6)}` : d);
                      const period = it.commStartDate && it.commEndDate
                        ? ` (${fmt(it.commStartDate)}~${fmt(it.commEndDate)})`
                        : it.resAttrYear ? ` (${it.resAttrYear}년)` : '';
                      return (
                        <option key={i} value={i}>{(it.resCompanyNm || it.resUserNm || `사업장 ${i + 1}`)}{period}</option>
                      );
                    })}
                  </select>
                )}
                {item && <DocCard docType={docKey} item={item} file={file} customerId={form.customerId} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// 부가세과세표준증명은 반기별로 여러 건이 올 수 있음 — 같은 회사면 하나로 합쳐서 보여줌.
// 기간: 조회된 것 중 가장 이른 시작일 ~ 가장 늦은 종료일. 금액: 반기별 합계.
// 원본 PDF는 반기마다 따로 존재하므로 _periods에 원본 목록을 보관해뒀다가 다운로드 시 전부 받게 함.
function aggregateTaxStandard(items) {
  const byCompany = {}
  for (const it of items) {
    const key = it.resCompanyNm || '상호 미확인'
    if (!byCompany[key]) {
      byCompany[key] = { ...it, resIncomeTotalAmt: 0, resIncomeAmt: 0, resDutyFreeAmt: 0, resTaxAmt: 0, _periods: [] }
    }
    const agg = byCompany[key]
    agg.resIncomeTotalAmt = String(Number(agg.resIncomeTotalAmt || 0) + Number(it.resIncomeTotalAmt || 0))
    agg.resIncomeAmt = String(Number(agg.resIncomeAmt || 0) + Number(it.resIncomeAmt || 0))
    agg.resDutyFreeAmt = String(Number(agg.resDutyFreeAmt || 0) + Number(it.resDutyFreeAmt || 0))
    agg.resTaxAmt = String(Number(agg.resTaxAmt || 0) + Number(it.resTaxAmt || 0))
    if (!agg.commStartDate || (it.commStartDate && it.commStartDate < agg.commStartDate)) agg.commStartDate = it.commStartDate
    if (!agg.commEndDate || (it.commEndDate && it.commEndDate > agg.commEndDate)) agg.commEndDate = it.commEndDate
    agg._periods.push(it)
  }
  return Object.values(byCompany)
}

function LoadingModal({ messages }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPhase((p) => (p + 1) % messages.length), 2200);
    return () => clearInterval(t);
  }, [messages]);

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

function buildRows(docType, item) {
  const fmtDate = (d) => (d && d.length === 8 ? `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}` : d);
  const fmtAmt = (n) => (n ? `${Number(n).toLocaleString('ko-KR')}원` : n);

  if (docType === 'additional-tax-standard') {
    return [
      ['사업자등록번호', item.resCompanyIdentityNo],
      ['대표자', item.resUserNm],
      ['주소', item.resUserAddr?.replaceAll('+', ' ')],
      ['업태 / 종목', [item.resBusinessTypes, item.resBusinessItems].filter(Boolean).join(' / ').replaceAll('+', ' ')],
      ['과세기간', [fmtDate(item.commStartDate), fmtDate(item.commEndDate)].filter(Boolean).join(' ~ ')],
      ['과세 총금액', fmtAmt(item.resIncomeTotalAmt)],
      ['소득금액(과세대상급여액)', fmtAmt(item.resIncomeAmt)],
      ['면세 금액', fmtAmt(item.resDutyFreeAmt)],
      ['세액', fmtAmt(item.resTaxAmt)],
      ['발급기관', item.resIssueOgzNm],
      ['발급번호', item.resIssueNo],
    ].filter(([, v]) => v);
  }

  if (docType === 'tax-payment-certificate') {
    const arrears = Array.isArray(item.resArrearsList) ? item.resArrearsList.filter((a) => a.resTaxItemName) : [];
    return [
      ['상호(법인)', item.resCompanyNm],
      ['사업자등록번호', item.resCompanyIdentityNo],
      ['성명(대표자)', item.resUserNm],
      ['주소', item.resUserAddr?.replaceAll('+', ' ')],
      ['납세상태', item.resPaymentTaxStatus],
      ['체납 내역', arrears.length > 0
        ? arrears.map((a) => `${a.resTaxItemName} ${fmtAmt(a.resLocalTaxAmt)}`).join(', ')
        : (item.resPaymentTaxStatus === '해당없음' ? '없음' : '')],
      ['유효기간', fmtDate(item.resValidPeriod)],
      ['발급기관', item.resIssueOgzNm],
      ['발급번호', item.resIssueNo],
    ].filter(([, v]) => v);
  }

  if (docType === 'localtax-payment-certificate') {
    const respites = Array.isArray(item.resRespiteList) ? item.resRespiteList.filter((r) => r.resTaxItemName) : [];
    return [
      ['상호(법인)', item.resCompanyNm],
      ['사업자등록번호', item.resCompanyIdentityNo],
      ['성명(대표자)', item.resUserNm],
      ['주소', item.resUserAddr?.replaceAll('+', ' ')],
      ['징수유예/체납처분유예', respites.length > 0
        ? respites.map((r) => `${r.resTaxItemName} ${fmtAmt(r.resLocalTaxAmt)}`).join(', ')
        : '없음'],
      ['유효기간', fmtDate(item.resValidPeriod)],
      ['발급기관', item.resIssueOgzNm],
      ['발급번호', item.resIssueNo],
    ].filter(([, v]) => v);
  }

  if (docType === 'financial-statement') {
    return [
      ['상호(성명)', item.resCompanyNm || item.resUserNm],
      ['사업자등록번호', item.resCompanyIdentityNo],
      ['업태 / 종목', [item.resBusinessTypes, item.resBusinessItems].filter(Boolean).join(' / ').replaceAll('+', ' ')],
      ['귀속연도', item.resAttrYear],
      ['작성(신고)일자', fmtDate(item.resReportingDate)],
      ['발급기관', item.resIssueOgzNm],
      ['발급번호', item.resIssueNo],
    ].filter(([, v]) => v);
  }

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

// 재무제표는 대차대조표/손익계산서가 (제목/코드/금액/구분) 배열로 오기 때문에
// 다른 문서들의 key-value 그리드와 별도로 표 형태로 렌더링함.
function FinancialTable({ title, rows }) {
  const fmtAmt = (n) => (n ? `${Number(n).toLocaleString('ko-KR')}원` : '');
  const visible = (rows || []).filter((r) => r._title);
  if (visible.length === 0) return null;
  return (
    <div style={{ marginTop: 16 }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: '#5A5952', margin: '0 0 6px' }}>{title}</p>
      <div style={{ border: '1px solid #E0DFDA', borderRadius: 8, overflow: 'hidden' }}>
        {visible.map((r, i) => (
          <div
            key={i}
            style={{
              display: 'flex', justifyContent: 'space-between', gap: 12,
              padding: '6px 12px', fontSize: 13,
              background: i % 2 ? '#FAFAF8' : '#fff',
            }}
          >
            <span style={{ color: '#5A5952' }}>{r._title}</span>
            <span style={{ color: '#2A2925', fontWeight: r._number === '1' ? 700 : 400, whiteSpace: 'nowrap' }}>
              {fmtAmt(r._amt)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DocCard({ docType, item, file, customerId }) {
  const rows = buildRows(docType, item);
  const doc = DOCUMENTS[docType];
  const periods = item._periods; // 부가세과세표준증명 합산 항목일 때만 존재 — 반기별 원본이 각각 들어있음
  const serverDownloadUrl = !periods && file && customerId ? `/api/customers/${customerId}/files/${file.id}/download` : null;
  const downloadable = periods ? periods.some((p) => p.resOriGinalData1) : !!item.resOriGinalData1;

  function downloadOne(target, label) {
    const base64 = target.resOriGinalData1
    if (!base64) return
    const byteChars = atob(base64)
    const bytes = new Uint8Array(byteChars.length)
    for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
    const blob = new Blob([bytes], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = label
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function downloadLocal() {
    const companyName = (item.resCompanyNm || '문서').replace(/[/\\?%*:|"<>]/g, '')
    if (periods) {
      // 반기별로 원본이 따로 있으므로 전부 파일로 내려받음 (브라우저가 순서대로 여러 개 저장)
      periods.forEach((p, i) => {
        if (!p.resOriGinalData1) return
        const periodLabel = p.commStartDate && p.commEndDate ? `${p.commStartDate}-${p.commEndDate}` : `${i + 1}`
        setTimeout(() => downloadOne(p, `${doc.label}_${companyName}_${periodLabel}.pdf`), i * 300)
      })
      return
    }
    downloadOne(item, `${doc.label}_${companyName}_${item.resIssueDate || ''}.pdf`)
  }

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #E0DFDA' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#2A2925' }}>
          {item.resCompanyNm || item.resUserNm || '상호 미확인'}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!customerId && (
            <span style={{ fontSize: 12, color: '#B0AFA9', whiteSpace: 'nowrap' }}>고객 미선택 — 파일함 저장 안 됨</span>
          )}
          {downloadable && (
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
      {docType === 'financial-statement' && (
        <>
          <FinancialTable title="대차대조표" rows={item.resBalanceSheet} />
          <FinancialTable title="손익계산서" rows={item.resIncomeStatement} />
        </>
      )}
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
