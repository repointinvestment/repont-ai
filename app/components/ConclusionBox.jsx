'use client';

// app/components/ConclusionBox.jsx
// 초보 수강생용 "결론" 박스 — 판정 결과(lib/policyFundVerdict.js)를 쉬운 말 세 묶음으로 압축:
//   지금 바로 넣을 수 있는 곳 / 조건 하나만 확인하면 되는 곳 / 지금은 안 되는 곳 + 먼저 확인할 것.
// 근거·수치는 아래 접힌 섹션("왜 그런지 보기")에 있음. 이 박스만 보고 움직여도 되게 만드는 게 목적.

export default function ConclusionBox({ verdict, analysis }) {
  if (!verdict) return null;
  const inst = verdict.institutions || [];
  const ready = inst.filter((i) => i.status === '접수 가능');
  const cond = inst.filter((i) => i.status === '조건부' || i.status === '확인 필요');
  const blocked = inst.filter((i) => i.status === '현재 불가');

  // 기관 이름을 짧게
  const short = (name) => name.replace(/\s*\(.*?\)\s*/g, '').replace('신용보증기금', '신보').replace('기술보증기금', '기보').replace('신용보증재단', '재단');

  // 접수 가능 기관 + 그 기관에서 넣을 자금 1~2개
  const readyLines = ready.map((i) => {
    const funds = (i.funds || []).filter((f) => !f.status || f.status === '가능').slice(0, 2).map((f) => f.name);
    return funds.length ? `${short(i.name)} — ${funds.join(', ')}` : short(i.name);
  });

  // "먼저 확인할 것": 조건부 사유 중 ❓ 항목과 checks의 💡 항목에서 뽑음
  const todo = [];
  for (const i of cond) {
    for (const f of i.funds || []) {
      const qs = (f.condition || '').split(' · ').filter((s) => s.startsWith('❓')).map((s) => s.replace('❓ ', ''));
      for (const q of qs) if (todo.length < 4 && !todo.includes(q)) todo.push(q);
    }
    if (!(i.funds || []).length && i.reasons?.[0] && todo.length < 4) todo.push(`${short(i.name)}: ${i.reasons[0]}`);
  }
  for (const c of analysis?.checks || []) {
    if (c.startsWith('💡') && todo.length < 4) todo.push(c.replace('💡 ', ''));
  }

  const box = { borderRadius: 12, padding: '12px 14px' };
  const h = { fontSize: 12, fontWeight: 700, margin: '0 0 6px' };
  const li = { fontSize: 13.5, lineHeight: 1.65, color: '#2A2925' };

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '22px 28px', marginBottom: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.05)', borderTop: '4px solid #2A2925' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <p style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#2A2925' }}>결론 — 이 고객, 어디에 넣을까</p>
        <span style={{ fontSize: 11.5, color: '#8A8A85' }}>근거는 아래 "왜 그런지 보기"에서</span>
      </div>

      {verdict.hardBlocks?.length > 0 && (
        <div style={{ ...box, background: '#FAECE7', marginBottom: 10 }}>
          <p style={{ ...h, color: '#712B13' }}>먼저 이것부터 해결해야 어디든 넣을 수 있어요</p>
          {verdict.hardBlocks.map((b, i) => <div key={i} style={{ ...li, color: '#712B13' }}>• {b}</div>)}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <div style={{ ...box, background: '#E1F5EE' }}>
          <p style={{ ...h, color: '#085041' }}>① 지금 바로 넣을 수 있는 곳</p>
          {readyLines.length ? readyLines.map((l, i) => <div key={i} style={li}>• {l}</div>) : <div style={{ ...li, color: '#8A8A85' }}>지금 조건으로는 없음 — ②를 먼저 확인</div>}
        </div>
        <div style={{ ...box, background: '#FAEEDA' }}>
          <p style={{ ...h, color: '#633806' }}>② 조건 확인하면 넣을 수 있는 곳</p>
          {cond.length ? cond.map((i, k) => <div key={k} style={li}>• {short(i.name)}</div>) : <div style={{ ...li, color: '#8A8A85' }}>없음</div>}
        </div>
        <div style={{ ...box, background: '#F1F0EC' }}>
          <p style={{ ...h, color: '#5F5E5A' }}>③ 지금은 안 되는 곳</p>
          {blocked.length ? blocked.map((i, k) => <div key={k} style={{ ...li, color: '#5F5E5A' }}>• {short(i.name)} <span style={{ fontSize: 12, color: '#8A8A85' }}>({i.reasons?.[0]?.split(' — ')[0]})</span></div>) : <div style={{ ...li, color: '#8A8A85' }}>없음</div>}
        </div>
      </div>

      {todo.length > 0 && (
        <div style={{ marginTop: 12, padding: '10px 14px', background: '#F7F5F0', borderRadius: 10 }}>
          <p style={{ ...h, color: '#2A2925' }}>고객에게 먼저 확인할 것</p>
          {todo.map((t, i) => <div key={i} style={li}>☐ {t}</div>)}
        </div>
      )}

      {readyLines.length > 1 && (
        <p style={{ fontSize: 12, color: '#5F5E5A', margin: '10px 0 0' }}>
          순서: 소진공 직접대출 먼저 접수 → 보증기관 접수 → 보증서 받고 대기 → 소진공 약정·입금 → 보증서로 은행 실행. 보증기관(재단·신보·기보)은 한 번에 한 곳만.
        </p>
      )}
    </div>
  );
}

export function Collapsible({ title, badge, defaultOpen = false, children }) {
  return (
    <details open={defaultOpen} style={{ background: '#fff', borderRadius: 14, marginBottom: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
      <summary style={{ cursor: 'pointer', padding: '16px 28px', fontSize: 14.5, fontWeight: 600, color: '#2A2925', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, color: '#8A8A85' }}>▸</span>
        {title}
        {badge && <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 20, background: '#EFEEE9', color: '#5F5E5A', fontWeight: 600 }}>{badge}</span>}
      </summary>
      <div style={{ padding: '0 0 4px' }}>{children}</div>
    </details>
  );
}
