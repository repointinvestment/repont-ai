'use client';

// app/components/ApplicationPipeline.jsx
// 고객 상세 페이지에 들어가는 파이프라인(상담→서류수집→신청→심사중→승인/부결) 패널.
// 접수 건을 추가하고, 단계를 옮기고, 부결 시 사유를 남기면 마스터 DB의 reapply_rule로 재신청 가능일을 자동 계산.

import { useState } from 'react';

// STAGES는 lib/applicationsStore.js(서버 전용, DB 연결 포함)에서 가져오지 않고 여기 그대로 둠 —
// 클라이언트 컴포넌트가 서버 전용 모듈(@/lib/db)을 번들에 끌고 들어가면 빌드가 깨짐.
const STAGES = ['상담', '서류수집', '신청', '심사중', '승인', '부결', '보류'];

const STAGE_COLOR = {
  '상담': { bg: '#EFEEE9', fg: '#5F5E5A' },
  '서류수집': { bg: '#E6F1FB', fg: '#0C447C' },
  '신청': { bg: '#FAEEDA', fg: '#633806' },
  '심사중': { bg: '#FAEEDA', fg: '#633806' },
  '승인': { bg: '#E1F5EE', fg: '#085041' },
  '부결': { bg: '#FAECE7', fg: '#712B13' },
  '보류': { bg: '#EFEEE9', fg: '#8A8A85' },
};
const REAPPLY_LABEL = {
  ready: { text: '재신청 가능', bg: '#E1F5EE', fg: '#085041' },
  waiting: { text: '재신청 대기', bg: '#EFEEE9', fg: '#5F5E5A' },
  waiting_for_announcement: { text: '공고 대기', bg: '#E6F1FB', fg: '#0C447C' },
  not_applicable: null,
};

const input = { width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #D3D1C7', fontSize: 13, boxSizing: 'border-box', background: '#fff' };
const btn = { padding: '7px 12px', borderRadius: 7, border: 'none', background: '#2A2925', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' };
const btnGhost = { ...btn, background: '#fff', color: '#2A2925', border: '1px solid #2A2925' };

export default function ApplicationPipeline({ customerId, applications, funds, onChange }) {
  const [adding, setAdding] = useState(false);
  const [newApp, setNewApp] = useState({ fundKey: '', fundName: '', institution: '', requestedAmount: '' });
  const [editingStage, setEditingStage] = useState(null); // { app, stage, decidedAt, rejectionReason, approvedAmount, region }
  const [saving, setSaving] = useState(false);

  const headers = { 'Content-Type': 'application/json' };

  async function submitNew() {
    if (!newApp.fundName.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/customers/${customerId}/applications`, { method: 'POST', headers, body: JSON.stringify(newApp) });
      setAdding(false);
      setNewApp({ fundKey: '', fundName: '', institution: '', requestedAmount: '' });
      onChange();
    } finally { setSaving(false); }
  }

  function pickFund(key) {
    const f = (funds || []).find((x) => x.key === key);
    setNewApp({ ...newApp, fundKey: key, fundName: f?.name || newApp.fundName, institution: f?.institution || newApp.institution });
  }

  function openStageEdit(app, stage) {
    setEditingStage({ app, stage, decidedAt: new Date().toISOString().slice(0, 10), rejectionReason: '', approvedAmount: '', region: '' });
  }

  async function submitStage() {
    const { app, stage, decidedAt, rejectionReason, approvedAmount, region } = editingStage;
    setSaving(true);
    try {
      await fetch(`/api/customers/${customerId}/applications/${app.id}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ stage, decidedAt, rejectionReason, approvedAmount: approvedAmount === '' ? null : Number(approvedAmount), region }),
      });
      setEditingStage(null);
      onChange();
    } finally { setSaving(false); }
  }

  async function removeApp(app) {
    if (!confirm(`"${app.fund_name}" 접수 건을 삭제할까요?`)) return;
    await fetch(`/api/customers/${customerId}/applications/${app.id}`, { method: 'DELETE' });
    onChange();
  }

  const fmtWon = (v) => (v == null ? null : v >= 10000 ? `${(v / 10000).toLocaleString()}억` : `${v.toLocaleString()}만원`);

  return (
    <div style={{ padding: '4px 28px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p style={{ fontSize: 12, color: '#8A8A85', margin: 0 }}>실제로 접수 넣은 건을 여기서 단계별로 관리합니다. 부결 시 사유를 남기면 재신청 가능일이 자동 계산됩니다.</p>
        <button type="button" style={btn} onClick={() => setAdding(true)}>+ 접수 추가</button>
      </div>

      {applications.length === 0 && !adding && (
        <p style={{ fontSize: 13, color: '#B0AEA5', margin: '10px 0' }}>아직 접수한 건이 없습니다.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {applications.map((app) => {
          const sc = STAGE_COLOR[app.stage] || STAGE_COLOR['상담'];
          const reapply = REAPPLY_LABEL[app.reapply_status];
          return (
            <div key={app.id} style={{ border: '1px solid #E8E6E0', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 13.5, color: '#2A2925' }}>{app.fund_name}</strong>
                    {app.institution && <span style={{ fontSize: 11, color: '#8A8A85' }}>{app.institution}</span>}
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: sc.bg, color: sc.fg, fontWeight: 700 }}>{app.stage}</span>
                    {reapply && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: reapply.bg, color: reapply.fg, fontWeight: 700 }}>
                      {reapply.text}{app.reapply_available_at ? ` (${String(app.reapply_available_at).slice(0, 10)})` : ''}
                    </span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#5F5E5A', marginTop: 5 }}>
                    {app.requested_amount != null && `신청 ${fmtWon(app.requested_amount)}`}
                    {app.approved_amount != null && ` → 승인 ${fmtWon(app.approved_amount)}`}
                    {app.submitted_at && ` · 신청일 ${String(app.submitted_at).slice(0, 10)}`}
                    {app.decided_at && ` · 결정일 ${String(app.decided_at).slice(0, 10)}`}
                  </div>
                  {app.rejection_reason && <div style={{ fontSize: 12.5, color: '#712B13', marginTop: 5 }}>부결 사유: {app.rejection_reason}</div>}
                </div>
                <button type="button" onClick={() => removeApp(app)} style={{ ...btnGhost, padding: '4px 9px', fontSize: 11, color: '#C0392B', borderColor: '#C0392B' }}>삭제</button>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                {STAGES.map((s) => (
                  <button key={s} type="button" onClick={() => openStageEdit(app, s)}
                    disabled={s === app.stage}
                    style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11.5, border: '1px solid #D3D1C7', background: s === app.stage ? '#F0EFEA' : '#fff', color: s === app.stage ? '#B0AEA5' : '#2A2925', cursor: s === app.stage ? 'default' : 'pointer' }}>
                    {s}로 이동
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {adding && (
        <div style={{ marginTop: 12, padding: 14, background: '#F7F5F0', borderRadius: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <span style={{ fontSize: 11.5, color: '#5F5E5A', display: 'block', marginBottom: 4 }}>자금 선택 (마스터 DB) — 목록에 없으면 직접 입력</span>
            <select style={input} value={newApp.fundKey} onChange={(e) => pickFund(e.target.value)}>
              <option value="">직접 입력</option>
              {(funds || []).map((f) => <option key={f.key} value={f.key}>{f.name} — {f.institution}</option>)}
            </select>
          </div>
          <div>
            <span style={{ fontSize: 11.5, color: '#5F5E5A', display: 'block', marginBottom: 4 }}>자금명 *</span>
            <input style={input} value={newApp.fundName} onChange={(e) => setNewApp({ ...newApp, fundName: e.target.value })} />
          </div>
          <div>
            <span style={{ fontSize: 11.5, color: '#5F5E5A', display: 'block', marginBottom: 4 }}>기관</span>
            <input style={input} value={newApp.institution} onChange={(e) => setNewApp({ ...newApp, institution: e.target.value })} />
          </div>
          <div>
            <span style={{ fontSize: 11.5, color: '#5F5E5A', display: 'block', marginBottom: 4 }}>신청 금액(만원)</span>
            <input style={input} value={newApp.requestedAmount} onChange={(e) => setNewApp({ ...newApp, requestedAmount: e.target.value })} />
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" style={btnGhost} onClick={() => setAdding(false)}>취소</button>
            <button type="button" style={btn} disabled={saving} onClick={submitNew}>{saving ? '저장 중…' : '추가'}</button>
          </div>
        </div>
      )}

      {editingStage && (
        <div onClick={() => setEditingStage(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, padding: 20, width: 380 }}>
            <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', color: '#2A2925' }}>{editingStage.app.fund_name} → {editingStage.stage}</p>
            {(editingStage.stage === '부결' || editingStage.stage === '승인') && (
              <div style={{ marginBottom: 10 }}>
                <span style={{ fontSize: 11.5, color: '#5F5E5A', display: 'block', marginBottom: 4 }}>{editingStage.stage}일</span>
                <input style={input} type="date" value={editingStage.decidedAt} onChange={(e) => setEditingStage({ ...editingStage, decidedAt: e.target.value })} />
              </div>
            )}
            {editingStage.stage === '부결' && (
              <>
                <div style={{ marginBottom: 10 }}>
                  <span style={{ fontSize: 11.5, color: '#5F5E5A', display: 'block', marginBottom: 4 }}>부결 사유</span>
                  <input style={input} value={editingStage.rejectionReason} onChange={(e) => setEditingStage({ ...editingStage, rejectionReason: e.target.value })} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <span style={{ fontSize: 11.5, color: '#5F5E5A', display: 'block', marginBottom: 4 }}>재단 재신청 지역 (재단 건일 때만)</span>
                  <select style={input} value={editingStage.region} onChange={(e) => setEditingStage({ ...editingStage, region: e.target.value })}>
                    <option value="">해당 없음</option>
                    <option value="수도권">수도권</option>
                    <option value="지방">지방</option>
                  </select>
                </div>
              </>
            )}
            {editingStage.stage === '승인' && (
              <div style={{ marginBottom: 10 }}>
                <span style={{ fontSize: 11.5, color: '#5F5E5A', display: 'block', marginBottom: 4 }}>승인 금액(만원)</span>
                <input style={input} value={editingStage.approvedAmount} onChange={(e) => setEditingStage({ ...editingStage, approvedAmount: e.target.value })} />
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button type="button" style={btnGhost} onClick={() => setEditingStage(null)}>취소</button>
              <button type="button" style={btn} disabled={saving} onClick={submitStage}>{saving ? '저장 중…' : '저장'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
