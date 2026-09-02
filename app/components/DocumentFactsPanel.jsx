'use client';

// app/components/DocumentFactsPanel.jsx
// 서류발급(CODEF)으로 받은 사실값과 CRM 입력값을 나란히 보여주고, 컨설턴트가 항목별로 '적용'을 눌러 CRM을 채우거나 고침.
// 원칙: 서류가 자동으로 CRM을 덮어쓰지 않음 — 진단 입력값이 主, 서류는 채움·검증 보조.

import { useState } from 'react';

const STATUS = {
  fill: { label: '채울 수 있음', bg: '#E6F1FB', fg: '#0C447C' },
  mismatch: { label: '불일치', bg: '#FAECE7', fg: '#712B13' },
  match: { label: '일치', bg: '#E1F5EE', fg: '#085041' },
  doc_only: { label: '참고', bg: '#EFEEE9', fg: '#5F5E5A' },
};

const fmt = (v) => (v == null || v === '' ? '—' : typeof v === 'number' ? v.toLocaleString() : String(v));

export default function DocumentFactsPanel({ data, onApply }) {
  const [busy, setBusy] = useState(null);
  if (!data) return null;
  const comparison = data.comparison || [];
  const sources = data.facts?.sources || {};
  const hasAnyDoc = Object.keys(sources).length > 0;

  if (!hasAnyDoc) return null; // 서류 하나도 안 받았으면 패널 자체를 숨김

  const applyOne = async (item) => {
    setBusy(item.field);
    const fields = {};
    if (item.field === 'businessAgeYears') fields.businessAgeYears = item.docValue;
    if (item.field === 'revenueAmount') fields.revenueAmount = item.docValue;
    if (item.field === 'industry') fields.industry = item.docValue;
    if (item.field === 'taxDelinquent') fields.taxDelinquent = item.rawValue;
    try { await onApply(fields); } finally { setBusy(null); }
  };

  const applyAll = async () => {
    setBusy('all');
    const fields = {};
    for (const it of comparison) {
      if (it.status !== 'fill' && it.status !== 'mismatch') continue;
      if (it.field === 'businessAgeYears') fields.businessAgeYears = it.docValue;
      if (it.field === 'revenueAmount') fields.revenueAmount = it.docValue;
      if (it.field === 'taxDelinquent') fields.taxDelinquent = it.rawValue;
    }
    try { await onApply(fields); } finally { setBusy(null); }
  };

  const actionable = comparison.filter((c) => c.status === 'fill' || c.status === 'mismatch');
  const docLabel = { 'corporate-registration': '사업자등록증명', 'additional-tax-standard': '부가세과세표준증명', 'tax-payment-certificate': '납세증명서', 'localtax-payment-certificate': '지방세 납세증명서', 'financial-statement': '재무제표' };

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '22px 28px', marginBottom: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <p style={{ fontSize: 15, fontWeight: 600, margin: 0, color: '#2A2925' }}>서류 기반 검증</p>
        {actionable.length > 0 && (
          <button type="button" onClick={applyAll} disabled={busy === 'all'}
            style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: '#2A2925', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
            {busy === 'all' ? '적용 중…' : `채울 수 있는 값 모두 적용 (${actionable.filter((c) => c.field !== 'industry').length})`}
          </button>
        )}
      </div>
      <p style={{ fontSize: 12, color: '#8A8A85', margin: '0 0 14px' }}>
        발급된 서류: {Object.keys(sources).map((k) => docLabel[k] || k).join(', ')} · 서류값은 자동 반영되지 않고 '적용'을 눌러야 CRM에 들어갑니다.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {comparison.map((c) => {
          const st = STATUS[c.status] || STATUS.doc_only;
          const canApply = (c.status === 'fill' || c.status === 'mismatch') && c.field !== 'localTaxDelinquent' && c.field !== 'financial';
          return (
            <div key={c.field} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 1fr auto', gap: 12, alignItems: 'center', padding: '10px 12px', borderRadius: 10, background: c.status === 'mismatch' ? '#FFF8F5' : '#F7F5F0' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#2A2925' }}>{c.label}</div>
                <span style={{ fontSize: 10.5, padding: '1px 7px', borderRadius: 999, background: st.bg, color: st.fg, fontWeight: 700 }}>{st.label}</span>
              </div>
              <div style={{ fontSize: 13 }}>
                <div style={{ fontSize: 11, color: '#8A8A85' }}>CRM 입력값</div>
                <div style={{ color: c.crmValue == null ? '#B0AEA5' : '#2A2925' }}>{fmt(c.crmValue)}</div>
              </div>
              <div style={{ fontSize: 13 }}>
                <div style={{ fontSize: 11, color: '#8A8A85' }}>서류값 · {c.docSource}</div>
                <div style={{ color: '#2A2925', fontWeight: c.status === 'mismatch' || c.status === 'fill' ? 600 : 400 }}>{fmt(c.docValue)}</div>
              </div>
              <div>
                {canApply ? (
                  <button type="button" onClick={() => applyOne(c)} disabled={busy === c.field}
                    style={{ padding: '6px 11px', borderRadius: 7, border: '1px solid #2A2925', background: '#fff', color: '#2A2925', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {busy === c.field ? '…' : c.status === 'fill' ? '채우기' : '서류값으로'}
                  </button>
                ) : <span style={{ fontSize: 11, color: '#B0AEA5' }}>{c.status === 'match' ? '✓' : ''}</span>}
              </div>
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: 11, color: '#B0AEA5', margin: '12px 0 0' }}>
        * 업종은 CRM이 분류형(도소매업 등)이고 서류는 세부 업태/종목이라 자동 비교하지 않습니다. 직원 수·기존 대출 잔액·스마트기기 등은 서류에 없어 진단 입력값을 그대로 씁니다.
      </p>
    </div>
  );
}
