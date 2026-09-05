'use client';
import DateYMDInput from './DateYMDInput';

const SOJINGONG_TYPES = [
  { key: 'sinYong', label: '신용취약소상공인자금' },
  { key: 'hyuksin', label: '혁신성장촉진자금' },
  { key: 'jaedo', label: '재도전특별자금' },
  { key: 'ilsi', label: '일시적경영애로자금' },
  { key: 'etc', label: '기타 소진공 직접대출' },
];

const SMART_DEVICES = [
  '3D 풋스캐너 / 3D 프린터',
  'AI CCTV / AI 두피분석 / AI 안면인식',
  'AI·IOT 온도관리시스템',
  '주문·예약·결제 키오스크',
  'QR/NFC 오더 / 테이블 오더',
  'AI·무게형·모듈형 무인판매기',
  '서빙로봇 / 헬퍼로봇 / 조리로봇',
  '디지털광고보드 / 디지털메뉴보드',
  '고객관리·예약·매출분석·재고관리 S/W',
  '온라인예약관리 / 매장멤버십관리시스템',
  '축산 육가공공정시스템',
];

const DEFAULT_DETAILS = {
  sojingongLoans: { sinYong: '', hyuksin: '', jaedo: '', ilsi: '', etc: '' },
  loans: {
    jaedan: '', jaedanDate: '', jaedanRegion: '',
    shinbo: '', shinboDate: '',
    gibo: '', giboDate: '',
    jungjingong: '', bizCredit: '',
    personal1: '', personal2: '', cardLoan: '', cashService: '',
  },
  hasBankruptcy: '', currentBizCount: '', smartDevices: [],
  exportRecord: '', salesGrowth: '', taxDelinquent: '', isFranchise: false,
};

export function mergeDetails(details) {
  return {
    ...DEFAULT_DETAILS,
    ...details,
    sojingongLoans: { ...DEFAULT_DETAILS.sojingongLoans, ...(details?.sojingongLoans || {}) },
    loans: { ...DEFAULT_DETAILS.loans, ...(details?.loans || {}) },
    smartDevices: details?.smartDevices || [],
  };
}

export default function PolicyFundDetailsFields({ businessAgeYears, onBusinessAgeYearsChange, details, onDetailsChange, inputStyle, labelStyle, sectionTitle }) {
  const d = mergeDetails(details);

  const set = (patch) => onDetailsChange({ ...d, ...patch });
  const setLoan = (key, val) => onDetailsChange({ ...d, loans: { ...d.loans, [key]: val } });
  const setSojingong = (key, val) => onDetailsChange({ ...d, sojingongLoans: { ...d.sojingongLoans, [key]: val } });
  const toggleDevice = (dev) => {
    const next = d.smartDevices.includes(dev) ? d.smartDevices.filter((x) => x !== dev) : [...d.smartDevices, dev];
    set({ smartDevices: next });
  };

  const yesNoBtn = (field, label) => (
    <label style={labelStyle}>
      {label}
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        {['yes', 'no'].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => set({ [field]: v })}
            style={{
              flex: 1, padding: '9px',
              border: `1.5px solid ${d[field] === v ? '#0f3460' : '#D3D1C7'}`,
              borderRadius: 8, background: d[field] === v ? '#0f3460' : '#fff',
              color: d[field] === v ? '#fff' : '#666', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {v === 'yes' ? '있음' : '없음'}
          </button>
        ))}
      </div>
    </label>
  );

  const rowStyle = { display: 'flex', gap: 12 };
  const halfStyle = { flex: 1 };

  return (
    <>
      <p style={sectionTitle}>정책자금 상세 정보 (정확한 한도 계산용)</p>
      <p style={{ fontSize: 12, color: '#8A8A85', margin: '-4px 0 8px' }}>
        입력하시면 대시보드에서 매출 추정치 대신 실제 잔액 기준 정확한 한도를 계산합니다. 비워두면 간단 추정치만 표시됩니다.
      </p>

      <label style={labelStyle}>
        업력 (년) — 위 "사업자등록일" 입력 시 자동 계산되어 채워집니다. 필요하면 직접 수정하세요.
        <input type="number" style={inputStyle} value={businessAgeYears} onChange={(e) => onBusinessAgeYearsChange(e.target.value)} placeholder="예: 3" />
      </label>

      <p style={{ fontSize: 13, fontWeight: 600, color: '#5F5E5A', margin: '16px 0 8px' }}>소진공 직접대출 현황 (만원)</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {SOJINGONG_TYPES.map(({ key, label }) => (
          <label key={key} style={labelStyle}>
            {label}
            <input style={inputStyle} value={d.sojingongLoans[key]} onChange={(e) => setSojingong(key, e.target.value.replace(/[^0-9]/g, ''))} placeholder="0" />
          </label>
        ))}
      </div>

      <p style={{ fontSize: 13, fontWeight: 600, color: '#5F5E5A', margin: '16px 0 8px' }}>신용보증재단 (만원)</p>
      <div style={rowStyle}>
        <label style={{ ...labelStyle, ...halfStyle }}>
          잔액
          <input style={inputStyle} value={d.loans.jaedan} onChange={(e) => setLoan('jaedan', e.target.value.replace(/[^0-9]/g, ''))} placeholder="0" />
        </label>
        <label style={{ ...labelStyle, ...halfStyle }}>
          최초 수령일
          <DateYMDInput value={d.loans.jaedanDate} onChange={(v) => setLoan('jaedanDate', v)} inputStyle={inputStyle} />
        </label>
      </div>
      <label style={labelStyle}>
        사업장 지역
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          {['수도권', '지방'].map((v) => (
            <button key={v} type="button" onClick={() => setLoan('jaedanRegion', v)} style={{
              flex: 1, padding: '9px',
              border: `1.5px solid ${d.loans.jaedanRegion === v ? '#0f3460' : '#D3D1C7'}`,
              borderRadius: 8, background: d.loans.jaedanRegion === v ? '#0f3460' : '#fff',
              color: d.loans.jaedanRegion === v ? '#fff' : '#666', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>{v}</button>
          ))}
        </div>
      </label>

      <p style={{ fontSize: 13, fontWeight: 600, color: '#5F5E5A', margin: '16px 0 8px' }}>신보 / 기보 (만원)</p>
      <div style={rowStyle}>
        <label style={{ ...labelStyle, ...halfStyle }}>
          신보 잔액
          <input style={inputStyle} value={d.loans.shinbo} onChange={(e) => setLoan('shinbo', e.target.value.replace(/[^0-9]/g, ''))} placeholder="0" />
        </label>
        <label style={{ ...labelStyle, ...halfStyle }}>
          신보 최초 수령일
          <DateYMDInput value={d.loans.shinboDate} onChange={(v) => setLoan('shinboDate', v)} inputStyle={inputStyle} />
        </label>
      </div>
      <div style={rowStyle}>
        <label style={{ ...labelStyle, ...halfStyle }}>
          기보 잔액
          <input style={inputStyle} value={d.loans.gibo} onChange={(e) => setLoan('gibo', e.target.value.replace(/[^0-9]/g, ''))} placeholder="0" />
        </label>
        <label style={{ ...labelStyle, ...halfStyle }}>
          기보 최초 수령일
          <DateYMDInput value={d.loans.giboDate} onChange={(v) => setLoan('giboDate', v)} inputStyle={inputStyle} />
        </label>
      </div>

      <p style={{ fontSize: 13, fontWeight: 600, color: '#5F5E5A', margin: '16px 0 8px' }}>기타 대출 (만원)</p>
      <div style={rowStyle}>
        <label style={{ ...labelStyle, ...halfStyle }}>
          중진공
          <input style={inputStyle} value={d.loans.jungjingong} onChange={(e) => setLoan('jungjingong', e.target.value.replace(/[^0-9]/g, ''))} placeholder="0" />
        </label>
        <label style={{ ...labelStyle, ...halfStyle }}>
          사업자 신용대출 (은행 담보·일반)
          <input style={inputStyle} value={d.loans.bizCredit} onChange={(e) => setLoan('bizCredit', e.target.value.replace(/[^0-9]/g, ''))} placeholder="0" />
        </label>
      </div>
      <div style={rowStyle}>
        <label style={{ ...labelStyle, ...halfStyle }}>
          1금융권 개인신용대출
          <input style={inputStyle} value={d.loans.personal1} onChange={(e) => setLoan('personal1', e.target.value.replace(/[^0-9]/g, ''))} placeholder="0" />
        </label>
        <label style={{ ...labelStyle, ...halfStyle }}>
          2금융권 개인신용대출
          <input style={inputStyle} value={d.loans.personal2} onChange={(e) => setLoan('personal2', e.target.value.replace(/[^0-9]/g, ''))} placeholder="0" />
        </label>
      </div>
      <div style={rowStyle}>
        <label style={{ ...labelStyle, ...halfStyle }}>
          카드론
          <input style={inputStyle} value={d.loans.cardLoan} onChange={(e) => setLoan('cardLoan', e.target.value.replace(/[^0-9]/g, ''))} placeholder="0" />
        </label>
        <label style={{ ...labelStyle, ...halfStyle }}>
          현금서비스
          <input style={inputStyle} value={d.loans.cashService} onChange={(e) => setLoan('cashService', e.target.value.replace(/[^0-9]/g, ''))} placeholder="0" />
        </label>
      </div>

      <p style={{ fontSize: 13, fontWeight: 600, color: '#5F5E5A', margin: '16px 0 8px' }}>추가 조건 확인</p>
      <div style={rowStyle}>
        {yesNoBtn('taxDelinquent', '국세·지방세 체납 여부')}
        {yesNoBtn('hasBankruptcy', '과거 폐업 이력')}
      </div>
      <div style={{ ...rowStyle, marginTop: 12 }}>
        {yesNoBtn('exportRecord', '최근 1년 수출 실적 1천달러 이상')}
        {yesNoBtn('salesGrowth', '2년 연속 매출 10% 이상 증가')}
      </div>
      <label style={{ ...labelStyle, marginTop: 12 }}>
        현재 사업자 수 (대표자 명의)
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          {[{ v: '1', l: '1개' }, { v: '2+', l: '2개 이상' }].map(({ v, l }) => (
            <button key={v} type="button" onClick={() => set({ currentBizCount: v })} style={{
              flex: 1, padding: '9px',
              border: `1.5px solid ${d.currentBizCount === v ? '#0f3460' : '#D3D1C7'}`,
              borderRadius: 8, background: d.currentBizCount === v ? '#0f3460' : '#fff',
              color: d.currentBizCount === v ? '#fff' : '#666', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>{l}</button>
          ))}
        </div>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, marginTop: 12 }}>
        <input type="checkbox" checked={!!d.isFranchise} onChange={(e) => set({ isFranchise: e.target.checked })} />
        프랜차이즈·가맹점 (요식업인 경우 신보 검토 대상 여부에 영향)
      </label>

      <p style={{ fontSize: 13, fontWeight: 600, color: '#5F5E5A', margin: '16px 0 8px' }}>스마트기기 보유 현황 (해당하는 것 모두 선택)</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {SMART_DEVICES.map((dev) => (
          <button
            key={dev}
            type="button"
            onClick={() => toggleDevice(dev)}
            style={{
              padding: '8px 12px', borderRadius: 20, fontSize: 12,
              border: `1.5px solid ${d.smartDevices.includes(dev) ? '#0f3460' : '#D3D1C7'}`,
              background: d.smartDevices.includes(dev) ? '#0f3460' : '#fff',
              color: d.smartDevices.includes(dev) ? '#fff' : '#666', cursor: 'pointer',
            }}
          >
            {dev}
          </button>
        ))}
      </div>
    </>
  );
}
