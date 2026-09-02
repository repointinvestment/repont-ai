'use client'

// app/admin/policy-funds/page.jsx
// 정책자금 마스터 DB 관리자 화면.
// 자금별 한도·금리·자격조건·재신청 규칙·필요서류를 코드 수정 없이 여기서 직접 고침.
// 이 데이터는 자격 자동판정, 부결 재신청 리마인더, 공고 매칭, AI 상담 프롬프트가 공통으로 읽음(순차 연결 예정).

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/session'
import AppHeader from '../../components/AppHeader'

const INSTITUTIONS = ['소상공인시장진흥공단', '지역신용보증재단', '신용보증기금', '기술보증기금', '중소벤처기업진흥공단', '지자체', '기타']
const FUND_TYPES = ['직접대출', '보증', '이차보전', '기타']
const REAPPLY_TYPES = [
  { value: 'none', label: '제한 없음 / 미확정' },
  { value: 'months', label: '기간 제한 (마지막 수령일 기준 N개월)' },
  { value: 'announcement', label: '공고 기준 (제한기간 없음, 공고 떠야 신청)' },
]

const emptyFund = () => ({
  name: '', institution: INSTITUTIONS[0], fund_type: FUND_TYPES[0],
  limit_operating: '', limit_facility: '', cap_group: '',
  rate_note: '', period_note: '', eligibility_summary: '',
  conditions: [], smart_devices: [], criteria: {},
  reapply_rule: { type: 'announcement', months: '', months_by_region: { 수도권: '', 지방: '' }, note: '' },
  required_docs: [], exclusive_group: '', notes: '', active: true, sort_order: 0,
})

export default function PolicyFundsAdminPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [funds, setFunds] = useState([])
  const [rules, setRules] = useState([])
  const [editing, setEditing] = useState(null) // fund object being edited (null = closed)
  const [editingRule, setEditingRule] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('funds')

  useEffect(() => {
    const s = getSession()
    if (!s) { router.push('/'); return }
    if (s.role !== 'admin') { router.push('/menu'); return }
    setUser(s)
    load()
  }, [])

  async function load() {
    const r = await fetch('/api/policy-funds')
    const d = await r.json()
    setFunds(d.funds || [])
    setRules(d.rules || [])
  }

  const headers = () => ({
    'Content-Type': 'application/json',
    'x-consultant-id': user?.username || '',
    'x-consultant-role': user?.role || '',
  })

  function openEdit(f) {
    // DB 값(숫자/null/JSON)을 폼 친화적으로 정리
    const rr = f?.reapply_rule || {}
    setEditing({
      ...emptyFund(),
      ...f,
      limit_operating: f?.limit_operating ?? '',
      limit_facility: f?.limit_facility ?? '',
      cap_group: f?.cap_group ?? '',
      exclusive_group: f?.exclusive_group ?? '',
      rate_note: f?.rate_note ?? '',
      period_note: f?.period_note ?? '',
      eligibility_summary: f?.eligibility_summary ?? '',
      notes: f?.notes ?? '',
      conditions: Array.isArray(f?.conditions) ? f.conditions : [],
      smart_devices: Array.isArray(f?.smart_devices) ? f.smart_devices : [],
      required_docs: Array.isArray(f?.required_docs) ? f.required_docs : [],
      criteria: f?.criteria || {},
      reapply_rule: {
        type: rr.type || 'announcement',
        months: rr.months ?? '',
        months_by_region: { 수도권: rr.months_by_region?.수도권 ?? '', 지방: rr.months_by_region?.지방 ?? '' },
        note: rr.note ?? '',
      },
    })
    setError(null)
  }

  function toPayload(e) {
    const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v))
    const rr = e.reapply_rule
    const reapply = { type: rr.type, note: rr.note || '' }
    if (rr.type === 'months') {
      if (rr.months !== '' && rr.months !== null) reapply.months = Number(rr.months)
      const byRegion = {}
      if (rr.months_by_region?.수도권 !== '' && rr.months_by_region?.수도권 != null) byRegion.수도권 = Number(rr.months_by_region.수도권)
      if (rr.months_by_region?.지방 !== '' && rr.months_by_region?.지방 != null) byRegion.지방 = Number(rr.months_by_region.지방)
      if (Object.keys(byRegion).length) reapply.months_by_region = byRegion
    }
    let criteria = e.criteria || {}
    if (typeof criteria === 'string') {
      try { criteria = JSON.parse(criteria || '{}') } catch { criteria = {} }
    }
    return {
      ...e,
      criteria,
      limit_operating: num(e.limit_operating),
      limit_facility: num(e.limit_facility),
      sort_order: Number(e.sort_order) || 0,
      cap_group: e.cap_group || null,
      exclusive_group: e.exclusive_group || null,
      conditions: (e.conditions || []).filter((c) => c.text?.trim()),
      smart_devices: (e.smart_devices || []).filter(Boolean),
      required_docs: (e.required_docs || []).filter(Boolean),
      reapply_rule: reapply,
    }
  }

  async function saveFund() {
    if (!editing.name?.trim()) { setError('자금명을 입력해주세요.'); return }
    setSaving(true); setError(null)
    try {
      const isNew = !editing.id
      const res = await fetch(isNew ? '/api/policy-funds' : `/api/policy-funds/${editing.id}`, {
        method: isNew ? 'POST' : 'PUT',
        headers: headers(),
        body: JSON.stringify(toPayload(editing)),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || '저장 실패')
      setEditing(null)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function removeFund(f) {
    if (!confirm(`"${f.name}" 자금을 삭제할까요? (되돌릴 수 없습니다. 잠깐 숨기려면 삭제 대신 '사용 중' 체크를 해제하세요)`)) return
    await fetch(`/api/policy-funds/${f.id}`, { method: 'DELETE', headers: headers() })
    await load()
  }

  async function saveRule() {
    if (!editingRule.title?.trim()) { setError('제목을 입력해주세요.'); return }
    setSaving(true); setError(null)
    try {
      const payload = { ...editingRule, key: editingRule.key || `rule_${Date.now()}`, sort_order: Number(editingRule.sort_order) || 0 }
      const res = await fetch('/api/policy-funds/rules', { method: 'PUT', headers: headers(), body: JSON.stringify(payload) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || '저장 실패')
      setEditingRule(null)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function removeRule(r) {
    if (!confirm(`"${r.title}" 규칙을 삭제할까요?`)) return
    await fetch(`/api/policy-funds/rules?key=${encodeURIComponent(r.key)}`, { method: 'DELETE', headers: headers() })
    await load()
  }

  if (!user) return null

  const fmtWon = (v) => (v == null ? '-' : v >= 10000 ? `${(v / 10000).toLocaleString()}억` : `${v.toLocaleString()}만`)
  const reapplyLabel = (rr) => {
    if (!rr || rr.type === 'none' || !rr.type) return '제한 없음'
    if (rr.type === 'announcement') return '공고 기준'
    if (rr.months_by_region) return `수도권 ${rr.months_by_region.수도권 ?? '-'}개월 / 지방 ${rr.months_by_region.지방 ?? '-'}개월`
    return `${rr.months ?? '-'}개월`
  }

  const input = { width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid #D3D1C7', fontSize: 13.5, boxSizing: 'border-box', background: '#fff' }
  const label = { fontSize: 12.5, color: '#5F5E5A', display: 'block', marginBottom: 5, fontWeight: 600 }
  const btn = { padding: '9px 14px', borderRadius: 8, border: 'none', background: '#2A2925', color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }
  const btnGhost = { ...btn, background: '#fff', color: '#2A2925', border: '1px solid #2A2925' }
  const btnDanger = { ...btn, background: '#fff', color: '#C0392B', border: '1px solid #C0392B' }
  const card = { background: '#fff', border: '1px solid #E0DFDA', borderRadius: 12, padding: 18 }

  return (
    <div style={{ minHeight: '100vh', background: '#F7F6F2' }}>
      <AppHeader user={user} />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px 60px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div>
            <h2 style={{ color: '#1a1a2e', margin: 0 }}>정책자금 마스터 DB</h2>
            <p style={{ fontSize: 13, color: '#8A8A85', margin: '6px 0 0' }}>
              자금별 한도·자격조건·재신청 규칙·필요서류를 여기서 직접 관리합니다. 자격 자동판정·부결 리마인더·공고 매칭이 이 데이터를 읽습니다.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btnGhost} onClick={() => router.push('/admin')}>계정 관리로</button>
            {tab === 'funds'
              ? <button style={btn} onClick={() => openEdit(null)}>+ 자금 추가</button>
              : <button style={btn} onClick={() => setEditingRule({ key: '', title: '', content: '', params: {}, sort_order: (rules.at(-1)?.sort_order || 0) + 10 })}>+ 규칙 추가</button>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, margin: '18px 0 14px' }}>
          {[['funds', `자금 (${funds.length})`], ['rules', `공통 규칙 (${rules.length})`]].map(([k, t]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              ...btnGhost, background: tab === k ? '#2A2925' : '#fff', color: tab === k ? '#fff' : '#2A2925',
            }}>{t}</button>
          ))}
        </div>

        {tab === 'funds' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {funds.map((f) => (
              <div key={f.id} style={{ ...card, opacity: f.active ? 1 : 0.55 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 15.5, color: '#1a1a2e' }}>{f.name}</strong>
                      <span style={{ fontSize: 11.5, padding: '2px 8px', borderRadius: 999, background: '#EFEEE9', color: '#5F5E5A' }}>{f.institution}</span>
                      <span style={{ fontSize: 11.5, padding: '2px 8px', borderRadius: 999, background: f.fund_type === '보증' ? '#E8F5E9' : '#E3F2FD', color: f.fund_type === '보증' ? '#2E7D32' : '#1565C0' }}>{f.fund_type}</span>
                      {!f.active && <span style={{ fontSize: 11.5, color: '#C0392B' }}>미사용</span>}
                      {f.exclusive_group && <span style={{ fontSize: 11.5, color: '#8A8A85' }}>배타그룹: {f.exclusive_group}</span>}
                    </div>
                    <div style={{ fontSize: 13, color: '#5F5E5A', marginTop: 6, lineHeight: 1.6 }}>
                      한도 운전 {fmtWon(f.limit_operating)} / 시설 {fmtWon(f.limit_facility)}
                      {f.cap_group ? ` · 총한도그룹 ${f.cap_group}` : ''}
                      {f.rate_note ? ` · ${f.rate_note}` : ''}
                      {' · 재신청 '}{reapplyLabel(f.reapply_rule)}
                    </div>
                    {f.eligibility_summary && <div style={{ fontSize: 13, color: '#2A2925', marginTop: 6 }}>{f.eligibility_summary}</div>}
                    {(f.conditions || []).length > 0 && (
                      <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12.5, color: '#5F5E5A', lineHeight: 1.6 }}>
                        {f.conditions.map((c, i) => (
                          <li key={i}><span style={{ color: c.kind === 'any' ? '#B26A00' : '#2E7D32', fontWeight: 600 }}>{c.kind === 'any' ? '[택1]' : '[필수]'}</span> {c.text}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button style={btnGhost} onClick={() => openEdit(f)}>수정</button>
                    <button style={btnDanger} onClick={() => removeFund(f)}>삭제</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'rules' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rules.map((r) => (
              <div key={r.id} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: 15, color: '#1a1a2e' }}>{r.title}</strong>
                    <div style={{ fontSize: 13, color: '#2A2925', marginTop: 6, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{r.content}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button style={btnGhost} onClick={() => setEditingRule({ ...r })}>수정</button>
                    <button style={btnDanger} onClick={() => removeRule(r)}>삭제</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ───────── 자금 편집 모달 ───────── */}
      {editing && (
        <Modal onClose={() => setEditing(null)} title={editing.id ? `자금 수정 — ${editing.name}` : '자금 추가'}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="자금명 *" full><input style={input} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field label="기관">
              <select style={input} value={editing.institution || ''} onChange={(e) => setEditing({ ...editing, institution: e.target.value })}>
                {INSTITUTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </Field>
            <Field label="유형">
              <select style={input} value={editing.fund_type || ''} onChange={(e) => setEditing({ ...editing, fund_type: e.target.value })}>
                {FUND_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="한도 — 운전자금 (만원)"><input style={input} type="number" value={editing.limit_operating} onChange={(e) => setEditing({ ...editing, limit_operating: e.target.value })} placeholder="예: 10000 (=1억)" /></Field>
            <Field label="한도 — 시설자금 (만원)"><input style={input} type="number" value={editing.limit_facility} onChange={(e) => setEditing({ ...editing, limit_facility: e.target.value })} placeholder="비우면 해당 없음" /></Field>
            <Field label="총한도 그룹 (잔액 합산 기준)"><input style={input} value={editing.cap_group} onChange={(e) => setEditing({ ...editing, cap_group: e.target.value })} placeholder="예: 소진공_기본_1억 / 소진공_확장_2억 / 신용취약_3천 / 재단_1억" /></Field>
            <Field label="배타 그룹 (같은 그룹끼리 동시 불가)"><input style={input} value={editing.exclusive_group} onChange={(e) => setEditing({ ...editing, exclusive_group: e.target.value })} placeholder="예: 보증기관" /></Field>
            <Field label="금리"><input style={input} value={editing.rate_note} onChange={(e) => setEditing({ ...editing, rate_note: e.target.value })} placeholder="예: 정책자금 기준금리 + 0.4%p" /></Field>
            <Field label="상환기간"><input style={input} value={editing.period_note} onChange={(e) => setEditing({ ...editing, period_note: e.target.value })} placeholder="예: 운전 5년 (거치 2년)" /></Field>
            <Field label="자격 요약 (한 줄 설명)" full><textarea style={{ ...input, minHeight: 60 }} value={editing.eligibility_summary} onChange={(e) => setEditing({ ...editing, eligibility_summary: e.target.value })} /></Field>

            <Field label="자격 조건 (필수 = 전부 충족 / 택1 = 택1끼리 묶어 그중 1개만)" full>
              {(editing.conditions || []).map((c, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <select style={{ ...input, width: 90, flexShrink: 0 }} value={c.kind} onChange={(e) => updateCond(i, { kind: e.target.value })}>
                    <option value="required">필수</option>
                    <option value="any">택1</option>
                  </select>
                  <input style={input} value={c.text} onChange={(e) => updateCond(i, { text: e.target.value })} />
                  <button style={{ ...btnDanger, padding: '6px 10px' }} onClick={() => setEditing({ ...editing, conditions: editing.conditions.filter((_, j) => j !== i) })}>×</button>
                </div>
              ))}
              <button style={{ ...btnGhost, padding: '6px 12px', fontSize: 12.5 }} onClick={() => setEditing({ ...editing, conditions: [...(editing.conditions || []), { kind: 'required', text: '' }] })}>+ 조건 추가</button>
            </Field>

            <Field label="재신청 규칙" full>
              <select style={input} value={editing.reapply_rule.type} onChange={(e) => setEditing({ ...editing, reapply_rule: { ...editing.reapply_rule, type: e.target.value } })}>
                {REAPPLY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              {editing.reapply_rule.type === 'months' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
                  <div><span style={label}>전 지역 공통 (개월)</span><input style={input} type="number" value={editing.reapply_rule.months} onChange={(e) => setEditing({ ...editing, reapply_rule: { ...editing.reapply_rule, months: e.target.value } })} placeholder="지역 구분 없으면 여기" /></div>
                  <div><span style={label}>수도권 (개월)</span><input style={input} type="number" value={editing.reapply_rule.months_by_region.수도권} onChange={(e) => setEditing({ ...editing, reapply_rule: { ...editing.reapply_rule, months_by_region: { ...editing.reapply_rule.months_by_region, 수도권: e.target.value } } })} /></div>
                  <div><span style={label}>지방 (개월)</span><input style={input} type="number" value={editing.reapply_rule.months_by_region.지방} onChange={(e) => setEditing({ ...editing, reapply_rule: { ...editing.reapply_rule, months_by_region: { ...editing.reapply_rule.months_by_region, 지방: e.target.value } } })} /></div>
                </div>
              )}
              <input style={{ ...input, marginTop: 8 }} value={editing.reapply_rule.note} onChange={(e) => setEditing({ ...editing, reapply_rule: { ...editing.reapply_rule, note: e.target.value } })} placeholder="메모 (예: 마지막 보증 수령일 기준)" />
            </Field>

            <Field label="필요서류 (한 줄에 하나)" full>
              <textarea style={{ ...input, minHeight: 90 }} value={(editing.required_docs || []).join('\n')} onChange={(e) => setEditing({ ...editing, required_docs: e.target.value.split('\n').map((s) => s.trim()) })} />
            </Field>

            {(editing.smart_devices?.length > 0 || /혁신성장/.test(editing.name || '')) && (
              <Field label="스마트기기 목록 (한 줄에 하나) — 혁신성장촉진자금용" full>
                <textarea style={{ ...input, minHeight: 120 }} value={(editing.smart_devices || []).join('\n')} onChange={(e) => setEditing({ ...editing, smart_devices: e.target.value.split('\n').map((s) => s.trim()) })} />
              </Field>
            )}

            <Field label="비고 / 실무 메모" full><textarea style={{ ...input, minHeight: 70 }} value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></Field>

            <Field label="판정용 수치 (JSON, 선택 — 자격 자동판정 엔진이 읽음)" full>
              <textarea style={{ ...input, minHeight: 70, fontFamily: 'monospace', fontSize: 12.5 }}
                value={typeof editing.criteria === 'string' ? editing.criteria : JSON.stringify(editing.criteria || {}, null, 2)}
                onChange={(e) => setEditing({ ...editing, criteria: e.target.value })}
                onBlur={(e) => { try { setEditing({ ...editing, criteria: JSON.parse(e.target.value || '{}') }) } catch { setError('판정용 수치 JSON 형식이 올바르지 않습니다.') } }} />
            </Field>

            <Field label="정렬 순서"><input style={input} type="number" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: e.target.value })} /></Field>
            <Field label="사용 여부">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, marginTop: 8 }}>
                <input type="checkbox" checked={!!editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> 사용 중 (체크 해제하면 판정·매칭에서 제외)
              </label>
            </Field>
          </div>
          {error && <p style={{ color: '#C0392B', fontSize: 13, margin: '12px 0 0' }}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
            <button style={btnGhost} onClick={() => setEditing(null)}>취소</button>
            <button style={btn} disabled={saving} onClick={saveFund}>{saving ? '저장 중...' : '저장'}</button>
          </div>
        </Modal>
      )}

      {/* ───────── 공통 규칙 편집 모달 ───────── */}
      {editingRule && (
        <Modal onClose={() => setEditingRule(null)} title={editingRule.id ? `규칙 수정 — ${editingRule.title}` : '규칙 추가'}>
          <Field label="제목 *" full><input style={input} value={editingRule.title} onChange={(e) => setEditingRule({ ...editingRule, title: e.target.value })} /></Field>
          <Field label="내용" full><textarea style={{ ...input, minHeight: 140 }} value={editingRule.content || ''} onChange={(e) => setEditingRule({ ...editingRule, content: e.target.value })} /></Field>
          <Field label="정렬 순서" full><input style={input} type="number" value={editingRule.sort_order ?? 0} onChange={(e) => setEditingRule({ ...editingRule, sort_order: e.target.value })} /></Field>
          {error && <p style={{ color: '#C0392B', fontSize: 13, margin: '12px 0 0' }}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
            <button style={btnGhost} onClick={() => setEditingRule(null)}>취소</button>
            <button style={btn} disabled={saving} onClick={saveRule}>{saving ? '저장 중...' : '저장'}</button>
          </div>
        </Modal>
      )}
    </div>
  )

  function updateCond(i, patch) {
    setEditing({ ...editing, conditions: editing.conditions.map((c, j) => (j === i ? { ...c, ...patch } : c)) })
  }
}

function Field({ label: text, children, full }) {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : 'auto' }}>
      <span style={{ fontSize: 12.5, color: '#5F5E5A', display: 'block', marginBottom: 5, fontWeight: 600 }}>{text}</span>
      {children}
    </div>
  )
}

function Modal({ title, children, onClose }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', overflowY: 'auto', zIndex: 1000 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#F7F6F2', borderRadius: 14, padding: 22, width: '100%', maxWidth: 820, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, color: '#1a1a2e', fontSize: 17 }}>{title}</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 22, cursor: 'pointer', color: '#5F5E5A' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}
