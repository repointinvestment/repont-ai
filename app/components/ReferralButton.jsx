'use client';

// app/components/ReferralButton.jsx
// "문수환 대표에게 의뢰" 버튼. 자동 감지가 아니라 컨설턴트가 상담 중 법인전환·절세·상속 이슈를
// 발견하면 직접 눌러서 케이스를 이관 (이슈 유형 선택 + 메모).

import { useState } from 'react';

const ISSUE_TYPES = ['법인전환', '절세', '상속', '기타'];

export default function ReferralButton({ customerId, existing = [] }) {
  const [open, setOpen] = useState(false);
  const [issueType, setIssueType] = useState('법인전환');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);

  const pending = existing.find((r) => r.status !== '완료');

  async function submit() {
    setSaving(true);
    try {
      await fetch(`/api/customers/${customerId}/referrals`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueType, note }),
      });
      setOpen(false);
      setSent(true);
      setNote('');
    } finally { setSaving(false); }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        style={{
          padding: '9px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
          background: pending ? '#FAEEDA' : '#2A2925', color: pending ? '#633806' : '#fff',
        }}>
        {pending ? `📮 문수환 대표에게 의뢰 중 (${pending.status})` : sent ? '📮 문수환 대표에게 의뢰 (다시 보내기)' : '📮 문수환 대표에게 의뢰'}
      </button>

      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, padding: 22, width: 400 }}>
            <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px', color: '#2A2925' }}>문수환 대표에게 의뢰</p>
            <p style={{ fontSize: 12, color: '#8A8A85', margin: '0 0 16px' }}>정책자금 범위를 넘는 이슈(법인전환·절세·상속 등)를 대표가 직접 처리하도록 이관합니다.</p>
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: '#5F5E5A', display: 'block', marginBottom: 6, fontWeight: 600 }}>이슈 유형</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {ISSUE_TYPES.map((t) => (
                  <button key={t} type="button" onClick={() => setIssueType(t)}
                    style={{ padding: '7px 12px', borderRadius: 7, border: issueType === t ? '2px solid #2A2925' : '1px solid #D3D1C7', background: issueType === t ? '#F0EFEA' : '#fff', fontSize: 12.5, cursor: 'pointer' }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: '#5F5E5A', display: 'block', marginBottom: 6, fontWeight: 600 }}>상황 메모</span>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 매출 급증으로 법인전환 검토 필요, 개인사업자 상태로는 세부담 커짐"
                style={{ width: '100%', minHeight: 80, padding: '9px 11px', borderRadius: 8, border: '1px solid #D3D1C7', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={() => setOpen(false)} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid #2A2925', background: '#fff', color: '#2A2925', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>취소</button>
              <button type="button" disabled={saving} onClick={submit} style={{ padding: '9px 14px', borderRadius: 8, border: 'none', background: '#2A2925', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {saving ? '보내는 중…' : '의뢰 보내기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
