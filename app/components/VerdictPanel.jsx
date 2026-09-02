'use client';

// app/components/VerdictPanel.jsx
// 접수 판정 패널 — 가능/불가 이분법이 아니라 "어느 기관에 어떤 자금으로 접수 가능 + 근거" 와
// 최종 결정 4요소(기존 부채·매출·재무제표·신용점수) 상태를 보여줌. lib/policyFundVerdict.js 결과를 렌더링.

const STATUS_STYLE = {
  '접수 가능': { bg: '#E1F5EE', fg: '#085041', dot: '#0F9B6E' },
  '조건부': { bg: '#FAEEDA', fg: '#633806', dot: '#D9A441' },
  '현재 불가': { bg: '#FAECE7', fg: '#712B13', dot: '#C0392B' },
  '확인 필요': { bg: '#EFEEE9', fg: '#5F5E5A', dot: '#9A9891' },
};
const LEVEL_COLOR = { good: '#0F9B6E', warn: '#D9A441', bad: '#C0392B', unknown: '#B0AEA5' };

export default function VerdictPanel({ verdict }) {
  if (!verdict) return null;
  const { institutions = [], factors = {}, hardBlocks = [] } = verdict;
  const canApply = institutions.filter((i) => i.status === '접수 가능');

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '24px 28px', marginBottom: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <p style={{ fontSize: 15, fontWeight: 600, margin: 0, color: '#2A2925' }}>접수 판정 — 어디에 무엇으로 넣을 수 있나</p>
        <span style={{ fontSize: 12, color: '#5F5E5A' }}>
          접수 가능 {canApply.length}곳 · 조건부 {institutions.filter((i) => i.status === '조건부').length}곳
        </span>
      </div>
      <p style={{ fontSize: 12, color: '#8A8A85', margin: '0 0 16px' }}>
        정책자금은 정답이 없고 경계선만 있습니다. 목표는 맞는 기관에 접수를 넣는 것 — 접수하면 담당자가 더 맞는 자금을 매칭해줍니다. 최종 결정은 아래 4요소로 납니다.
      </p>

      {hardBlocks.length > 0 && (
        <div style={{ background: '#FAECE7', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
          {hardBlocks.map((b, i) => <div key={i} style={{ fontSize: 13, color: '#712B13', lineHeight: 1.6 }}>⚠️ {b}</div>)}
        </div>
      )}

      {/* 4요소 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 18 }}>
        {['debt', 'sales', 'financial', 'credit'].map((k) => {
          const f = factors[k];
          if (!f) return null;
          return (
            <div key={k} style={{ background: '#F7F5F0', borderRadius: 10, padding: '12px 14px', borderTop: `3px solid ${LEVEL_COLOR[f.level] || LEVEL_COLOR.unknown}` }}>
              <div style={{ fontSize: 11.5, color: '#8A8A85', marginBottom: 4 }}>{f.label}</div>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: '#2A2925' }}>{f.value}</div>
              <div style={{ fontSize: 12, color: '#5F5E5A', marginTop: 4, lineHeight: 1.5 }}>{f.assessment}</div>
              {f.docNote && <div style={{ fontSize: 11.5, color: '#0C447C', marginTop: 4 }}>{f.docNote}</div>}
            </div>
          );
        })}
      </div>

      {/* 기관별 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {institutions.map((inst) => {
          const st = STATUS_STYLE[inst.status] || STATUS_STYLE['확인 필요'];
          return (
            <div key={inst.key} style={{ border: '1px solid #E8E6E0', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: st.dot, display: 'inline-block' }} />
                <strong style={{ fontSize: 14.5, color: '#2A2925' }}>{inst.name}</strong>
                <span style={{ fontSize: 11.5, padding: '2px 9px', borderRadius: 999, background: st.bg, color: st.fg, fontWeight: 700 }}>{inst.status}</span>
              </div>
              {inst.funds.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                  {inst.funds.map((f, i) => {
                    const cond = f.status === '조건부';
                    return (
                      <div key={i} style={{ padding: '8px 12px', borderRadius: 8, background: cond ? '#FAF7EE' : '#E6F1FB', borderLeft: `3px solid ${cond ? '#D9A441' : '#0C447C'}` }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: cond ? '#633806' : '#0C447C' }}>
                          {f.status ? `[${f.status}] ` : ''}{f.name} · {f.limit}
                        </div>
                        {f.condition && <div style={{ fontSize: 12, color: '#5F5E5A', marginTop: 3, lineHeight: 1.5 }}>{f.condition}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#2A2925', lineHeight: 1.7 }}>
                {inst.reasons.map((r, i) => <li key={i}>{r}</li>)}
                {inst.caveats.map((c, i) => <li key={`c${i}`} style={{ color: '#5F5E5A' }}>{c}</li>)}
              </ul>
              {inst.excluded?.length > 0 && (
                <details style={{ marginTop: 8 }}>
                  <summary style={{ fontSize: 12, color: '#8A8A85', cursor: 'pointer' }}>제외된 자금 {inst.excluded.length}개 — 사유 보기</summary>
                  <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12, color: '#8A8A85', lineHeight: 1.6 }}>
                    {inst.excluded.map((e, i) => <li key={i}>{e.name}: {e.why}</li>)}
                  </ul>
                </details>
              )}
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: 11, color: '#B0AEA5', margin: '14px 0 0' }}>
        * '조건부'는 접수를 아예 포기할 사유가 아니라 확인·보강 후 넣어볼 여지가 있다는 뜻입니다. 대환·보증기관 병행은 대표에게 보고 후 진행.
      </p>
    </div>
  );
}
