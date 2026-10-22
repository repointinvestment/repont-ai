'use client'
import { useState } from 'react'

// 사업계획서 본문(텍스트)을 "제출 서류" 모양으로 렌더링.
// 생성 API가 내는 형식을 그대로 해석: **굵은 제목**, "1. 제목"/"필수10. 제목", [별첨1]·[공동대표자] 같은 꺾쇠 소제목,
// "a | b | c" 표, "- " 목록, "라벨      : 값" 입력칸, ※ 안내문, ________ 빈칸, [확인필요] 표시.

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function inline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\[확인필요\]/g, '<span class="pd-check">확인필요</span>')
    .replace(/_{4,}/g, '<span class="pd-blank"></span>')
}
const isRow = (t) => t.split('|').length >= 3 && !/^※/.test(t)
const splitRow = (t) => t.split('|').map((c) => c.trim())
const isField = (t) => !/^[※\-•·]/.test(t) && /^[^:|]{1,26}?\s*:\s/.test(t) && t.length < 140 && !/[.。]\s/.test(t.split(':')[0]) && !/^합계\s*[:：]/.test(t)

export function parsePlan(content) {
  const lines = String(content || '').replace(/\r/g, '').replace(/이 초안은/g, '이 사업계획서는').split('\n')
  const blocks = []
  let i = 0
  while (i < lines.length) {
    const t = lines[i].trim()
    if (!t) { i++; continue }
    if (/^표:\s*/.test(t) && t.includes('|')) {
      const rows = [splitRow(t.replace(/^표:\s*/, ''))]
      i++
      while (i < lines.length && isRow(lines[i].trim())) { rows.push(splitRow(lines[i].trim())); i++ }
      blocks.push({ type: 'table', rows }); continue
    }
    if (isRow(t)) {
      const rows = []
      while (i < lines.length && isRow(lines[i].trim())) { rows.push(splitRow(lines[i].trim())); i++ }
      blocks.push({ type: 'table', rows }); continue
    }
    const bold = t.match(/^\*\*(.+?)\*\*:?$/)
    if (bold) { blocks.push({ type: 'h2', text: bold[1] }); i++; continue }
    if (/^(\d{1,2}|필수\s?\d+|선택\s?\d+)\.\s+\S/.test(t) && t.length < 120) { blocks.push({ type: 'h2', text: t }); i++; continue }
    if (/^#{1,3}\s+/.test(t)) { blocks.push({ type: 'h2', text: t.replace(/^#+\s+/, '') }); i++; continue }
    const br = t.match(/^\[([^\]]{1,40})\]\s*(.*)$/)
    if (br && !/^\[확인필요\]/.test(t)) {
      blocks.push({ type: 'h3', text: br[1], rest: br[2] }); i++; continue
    }
    if (/^◦\s*/.test(t)) { blocks.push({ type: 'h3', text: t.replace(/^◦\s*/, '') }); i++; continue }
    if (/^※/.test(t)) { blocks.push({ type: 'note', text: t }); i++; continue }
    if (/^[-•·]\s+/.test(t)) {
      const items = []
      while (i < lines.length && /^[-•·]\s+/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^[-•·]\s+/, '')); i++ }
      blocks.push({ type: 'list', items }); continue
    }
    if (isField(t)) {
      const fields = []
      while (i < lines.length && isField(lines[i].trim())) {
        const idx = lines[i].indexOf(':')
        fields.push([lines[i].slice(0, idx).trim(), lines[i].slice(idx + 1).trim()]); i++
      }
      blocks.push({ type: 'fields', fields }); continue
    }
    if (/^합계\s*[:：]/.test(t)) { blocks.push({ type: 'total', text: t }); i++; continue }
    blocks.push({ type: 'p', text: t }); i++
  }
  return blocks
}

const CSS = `
.pd-wrap{font-family:'Noto Sans KR','Noto Sans CJK KR',-apple-system,sans-serif;color:#1d2733}
.pd-paper{background:#fff;border:1px solid #E4E2DB;border-radius:14px;box-shadow:0 8px 30px rgba(11,36,64,.10);overflow:hidden}
.pd-head{background:linear-gradient(135deg,#0B2440 0%,#12345c 100%);color:#FBF7EE;padding:26px 34px 22px;position:relative}
.pd-head:after{content:'';position:absolute;left:0;right:0;bottom:0;height:3px;background:linear-gradient(90deg,#B4923F,#E9C979,#B4923F)}
.pd-kicker{font-size:11px;letter-spacing:.3em;color:#E9C979;font-weight:700;margin:0 0 8px}
.pd-title{font-family:'Noto Serif KR','Noto Serif CJK KR',serif;font-size:22px;font-weight:700;margin:0 0 6px;line-height:1.35}
.pd-sub{font-size:13px;color:#A9BDD4;margin:0}
.pd-meta{display:flex;flex-wrap:wrap;gap:0 22px;margin-top:14px;font-size:12.5px;color:#C9D7E6}
.pd-meta b{color:#FBF7EE;font-weight:600;margin-left:6px}
.pd-body{padding:28px 34px 30px;font-size:13.5px;line-height:1.85}
.pd-h2{font-family:'Noto Serif KR','Noto Serif CJK KR',serif;font-size:16px;color:#0B2440;margin:26px 0 10px;padding-left:12px;border-left:4px solid #B4923F;line-height:1.4}
.pd-h2:first-child{margin-top:0}
.pd-h3{font-size:13.5px;font-weight:700;color:#0B2440;margin:18px 0 6px}
.pd-h3 .pd-rest{font-weight:400;color:#6B7480;font-size:12.5px;margin-left:8px}
.pd-p{margin:0 0 12px;text-align:justify;word-break:keep-all}
.pd-list{margin:0 0 12px 18px;padding:0}.pd-list li{margin:3px 0}
.pd-table{border-collapse:collapse;width:100%;margin:8px 0 16px;font-size:12.5px}
.pd-table th,.pd-table td{border:1px solid #D9D3C4;padding:7px 10px;text-align:left;vertical-align:top}
.pd-table th{background:#F3EEDF;color:#0B2440;font-weight:700}
.pd-table td.num{text-align:right;white-space:nowrap}
.pd-fields{border-collapse:collapse;width:100%;margin:6px 0 14px;font-size:12.8px}
.pd-fields th{width:30%;background:#F7F4EA;color:#0B2440;font-weight:600;text-align:left;border:1px solid #E4DCC6;padding:7px 10px}
.pd-fields td{border:1px solid #E4DCC6;padding:7px 10px}
.pd-total{text-align:right;font-weight:700;color:#0B2440;margin:-8px 0 14px}
.pd-note{background:#FBF8EE;border-left:3px solid #B4923F;color:#5F5E5A;font-size:12px;padding:8px 12px;margin:14px 0 0;line-height:1.7}
.pd-check{display:inline-block;background:#FFF3CD;color:#8A6D1A;border:1px solid #F0DDA8;border-radius:4px;font-size:11px;font-weight:700;padding:0 6px;margin:0 2px;vertical-align:middle}
.pd-blank{display:inline-block;min-width:72px;border-bottom:1.5px dotted #8A8A85;height:1em;vertical-align:baseline;margin:0 3px}
.pd-foot{display:flex;justify-content:space-between;align-items:center;padding:12px 34px;border-top:1px solid #EEE9DA;background:#FAF9F6;font-size:11.5px;color:#8A8A85}
.pd-foot b{color:#0B2440;font-family:'Noto Serif KR',serif}
.pd-tools{display:flex;justify-content:flex-end;gap:8px;margin-bottom:10px}
.pd-btn{padding:6px 13px;border-radius:7px;border:1px solid #D3D1C7;background:#fff;font-size:12px;cursor:pointer;color:#2A2925}
.pd-btn.primary{background:#0B2440;color:#fff;border-color:#0B2440}
@media (max-width:640px){.pd-head{padding:20px 18px 16px}.pd-body{padding:20px 18px}.pd-foot{padding:10px 18px}.pd-title{font-size:19px}}
@media print{
  body *{visibility:hidden}
  .pd-print,.pd-print *{visibility:visible}
  .pd-print{position:absolute;left:0;top:0;width:100%}
  .pd-tools{display:none}
  .pd-paper{border:none;box-shadow:none;border-radius:0}
  .pd-head{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .pd-table th,.pd-fields th,.pd-note,.pd-check{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
`

function Block({ b }) {
  if (b.type === 'h2') return <h2 className="pd-h2" dangerouslySetInnerHTML={{ __html: inline(b.text) }} />
  if (b.type === 'h3') return <h3 className="pd-h3"><span dangerouslySetInnerHTML={{ __html: inline(b.text) }} />{b.rest && <span className="pd-rest" dangerouslySetInnerHTML={{ __html: inline(b.rest) }} />}</h3>
  if (b.type === 'note') return <div className="pd-note" dangerouslySetInnerHTML={{ __html: inline(b.text) }} />
  if (b.type === 'total') return <p className="pd-total" dangerouslySetInnerHTML={{ __html: inline(b.text) }} />
  if (b.type === 'list') return <ul className="pd-list">{b.items.map((it, i) => <li key={i} dangerouslySetInnerHTML={{ __html: inline(it) }} />)}</ul>
  if (b.type === 'fields') return (
    <table className="pd-fields"><tbody>{b.fields.map(([k, v], i) => <tr key={i}><th dangerouslySetInnerHTML={{ __html: inline(k) }} /><td dangerouslySetInnerHTML={{ __html: inline(v) }} /></tr>)}</tbody></table>
  )
  if (b.type === 'table') {
    const [head, ...rows] = b.rows
    return (
      <table className="pd-table">
        <thead><tr>{head.map((c, i) => <th key={i} dangerouslySetInnerHTML={{ __html: inline(c) }} />)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={/^[+\-\d,.\s%만원억원]+$/.test(c) && j > 0 ? 'num' : ''} dangerouslySetInnerHTML={{ __html: inline(c) }} />)}</tr>)}</tbody>
      </table>
    )
  }
  return <p className="pd-p" dangerouslySetInnerHTML={{ __html: inline(b.text) }} />
}

export default function PlanDocument({ content, fundName, ownerName, businessName, createdAt, author, showTools = true }) {
  const [copied, setCopied] = useState('')
  const blocks = parsePlan(content)
  const date = createdAt ? new Date(createdAt) : new Date()
  const dateStr = date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
  const copy = async () => {
    try { await navigator.clipboard.writeText(String(content || '')); setCopied('복사됨'); setTimeout(() => setCopied(''), 2000) } catch { setCopied('복사 실패') }
  }
  return (
    <div className="pd-wrap pd-print">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@500;700;900&family=Noto+Sans+KR:wght@400;500;600;700&display=swap');${CSS}`}</style>
      {showTools && (
        <div className="pd-tools">
          <button type="button" className="pd-btn" onClick={copy}>{copied || '전체 복사'}</button>
          <button type="button" className="pd-btn primary" onClick={() => window.print()}>인쇄 · PDF 저장</button>
        </div>
      )}
      <div className="pd-paper">
        <div className="pd-head">
          <p className="pd-kicker">BUSINESS PLAN · 사업계획서</p>
          <h1 className="pd-title">{businessName || ownerName || '사업계획서'}{fundName ? <span style={{ fontWeight: 500, color: '#C9D7E6', fontSize: 15, marginLeft: 10 }}>{fundName} 신청용</span> : null}</h1>
          <p className="pd-sub">정책자금 신청을 위한 사업 개요 · 자금 사용 계획 · 상환 계획</p>
          <div className="pd-meta">
            {ownerName && <span>대표자<b>{ownerName}</b></span>}
            {businessName && <span>업체명<b>{businessName}</b></span>}
            <span>작성일<b>{dateStr}</b></span>
            {author && <span>담당<b>{author}</b></span>}
          </div>
        </div>
        <div className="pd-body">
          {blocks.map((b, i) => <Block key={i} b={b} />)}
        </div>
        <div className="pd-foot">
          <span><b>자금비서</b> · AI 작성 후 담당 컨설턴트 검토</span>
          <span>{dateStr}</span>
        </div>
      </div>
    </div>
  )
}
