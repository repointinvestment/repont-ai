'use client';

// app/simulator/page.js
// 대출 상환 시뮬레이터 (로드맵 7번). 원금·금리·기간·거치기간·상환방식을 입력하면
// 월별 상환 스케줄과 총 이자를 계산. DB 저장 없이 순수 계산 — 상담 중 바로 보여주는 용도.

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/session';
import { useEffect } from 'react';
import AppHeader from '../components/AppHeader';

const METHODS = [
  { key: 'equal_payment', label: '원리금균등상환' },
  { key: 'equal_principal', label: '원금균등상환' },
  { key: 'bullet', label: '만기일시상환 (거치기간만 이자만)' },
];

function buildSchedule({ principal, annualRatePct, termMonths, graceMonths, method }) {
  const monthlyRate = annualRatePct / 100 / 12;
  const repayMonths = Math.max(termMonths - graceMonths, 1);
  const rows = [];
  let balance = principal;

  // 거치기간: 원금 상환 없이 이자만 납부
  for (let m = 1; m <= graceMonths; m++) {
    const interest = Math.round(balance * monthlyRate);
    rows.push({ month: m, phase: '거치', principal: 0, interest, payment: interest, balance });
  }

  if (method === 'bullet') {
    for (let m = graceMonths + 1; m <= termMonths; m++) {
      const interest = Math.round(balance * monthlyRate);
      const isLast = m === termMonths;
      const principalPay = isLast ? balance : 0;
      rows.push({ month: m, phase: '상환', principal: principalPay, interest, payment: principalPay + interest, balance: isLast ? 0 : balance });
      if (isLast) balance = 0;
    }
  } else if (method === 'equal_principal') {
    const principalPerMonth = Math.round(principal / repayMonths);
    for (let i = 1; i <= repayMonths; i++) {
      const interest = Math.round(balance * monthlyRate);
      const isLast = i === repayMonths;
      const principalPay = isLast ? balance : principalPerMonth;
      balance = Math.max(0, balance - principalPay);
      rows.push({ month: graceMonths + i, phase: '상환', principal: principalPay, interest, payment: principalPay + interest, balance });
    }
  } else {
    // 원리금균등: PMT 공식
    const pmt = monthlyRate === 0 ? principal / repayMonths : (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -repayMonths));
    for (let i = 1; i <= repayMonths; i++) {
      const interest = Math.round(balance * monthlyRate);
      const isLast = i === repayMonths;
      let principalPay = Math.round(pmt - interest);
      if (isLast || principalPay > balance) principalPay = balance;
      balance = Math.max(0, balance - principalPay);
      rows.push({ month: graceMonths + i, phase: '상환', principal: principalPay, interest, payment: principalPay + interest, balance });
    }
  }
  return rows;
}

const fmt = (n) => Math.round(n).toLocaleString('ko-KR');
const input = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D3D1C7', fontSize: 14, boxSizing: 'border-box', background: '#fff' };
const label = { fontSize: 12.5, color: '#5F5E5A', display: 'block', marginBottom: 5, fontWeight: 600 };

export default function SimulatorPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ principal: '10000', annualRatePct: '4.0', termMonths: '60', graceMonths: '24', method: 'equal_payment' });
  const [showSchedule, setShowSchedule] = useState(false);

  useEffect(() => {
    const s = getSession();
    if (!s) { router.push('/'); return; }
    setUser(s);
  }, []);

  const parsed = {
    principal: Number(form.principal) * 10000 || 0, // 입력은 만원 단위
    annualRatePct: Number(form.annualRatePct) || 0,
    termMonths: Number(form.termMonths) || 1,
    graceMonths: Math.min(Number(form.graceMonths) || 0, Number(form.termMonths) - 1 || 0),
    method: form.method,
  };

  const schedule = useMemo(() => buildSchedule(parsed), [form.principal, form.annualRatePct, form.termMonths, form.graceMonths, form.method]);
  const totalInterest = schedule.reduce((s, r) => s + r.interest, 0);
  const totalPayment = schedule.reduce((s, r) => s + r.payment, 0);
  const firstRepayRow = schedule.find((r) => r.phase === '상환');

  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#F7F6F2' }}>
      <AppHeader user={user} />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 20px 60px' }}>
        <h2 style={{ color: '#1a1a2e', margin: '0 0 4px' }}>대출 상환 시뮬레이터</h2>
        <p style={{ fontSize: 13, color: '#8A8A85', margin: '0 0 20px' }}>원금·금리·기간·거치기간을 넣으면 월별 상환액과 총 이자를 계산합니다. 상담 중 고객에게 바로 보여줄 때 씁니다.</p>

        <div style={{ background: '#fff', borderRadius: 14, padding: 22, boxShadow: '0 2px 12px rgba(0,0,0,0.05)', marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
            <div>
              <span style={label}>대출 원금 (만원)</span>
              <input style={input} value={form.principal} onChange={(e) => setForm({ ...form, principal: e.target.value })} />
            </div>
            <div>
              <span style={label}>연 금리 (%)</span>
              <input style={input} value={form.annualRatePct} onChange={(e) => setForm({ ...form, annualRatePct: e.target.value })} />
            </div>
            <div>
              <span style={label}>총 대출기간 (개월)</span>
              <input style={input} value={form.termMonths} onChange={(e) => setForm({ ...form, termMonths: e.target.value })} />
            </div>
            <div>
              <span style={label}>거치기간 (개월, 이자만 납부)</span>
              <input style={input} value={form.graceMonths} onChange={(e) => setForm({ ...form, graceMonths: e.target.value })} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <span style={label}>상환 방식</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {METHODS.map((m) => (
                  <button key={m.key} type="button" onClick={() => setForm({ ...form, method: m.key })}
                    style={{ flex: 1, padding: '10px', borderRadius: 8, border: form.method === m.key ? '2px solid #2A2925' : '1px solid #D3D1C7', background: form.method === m.key ? '#F0EFEA' : '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
            <p style={{ fontSize: 12, color: '#8A8A85', margin: '0 0 6px' }}>{form.method === 'equal_payment' ? '월 납입액 (거치기간 끝나고 원금상환 시작 시, 고정)' : '첫 회차 납입액 (거치기간 끝나고 원금상환 시작 시)'}</p>
            <p style={{ fontSize: 20, fontWeight: 700, color: '#2A2925', margin: 0 }}>{firstRepayRow ? `${fmt(firstRepayRow.payment)}만원` : '-'}</p>
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
            <p style={{ fontSize: 12, color: '#8A8A85', margin: '0 0 6px' }}>총 이자</p>
            <p style={{ fontSize: 20, fontWeight: 700, color: '#712B13', margin: 0 }}>{fmt(totalInterest)}만원</p>
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
            <p style={{ fontSize: 12, color: '#8A8A85', margin: '0 0 6px' }}>총 상환액 (원금+이자)</p>
            <p style={{ fontSize: 20, fontWeight: 700, color: '#2A2925', margin: 0 }}>{fmt(totalPayment)}만원</p>
          </div>
        </div>

        <button type="button" onClick={() => setShowSchedule(!showSchedule)} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid #2A2925', background: '#fff', color: '#2A2925', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 12 }}>
          {showSchedule ? '월별 스케줄 숨기기' : '월별 스케줄 보기'}
        </button>

        {showSchedule && (
          <div style={{ background: '#fff', borderRadius: 14, padding: 8, boxShadow: '0 2px 12px rgba(0,0,0,0.05)', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E0DFDA' }}>
                  {['회차', '구분', '납입액(만원)', '원금(만원)', '이자(만원)', '잔액(만원)'].map((h) => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'right', color: '#5F5E5A' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {schedule.map((r) => (
                  <tr key={r.month} style={{ borderBottom: '1px solid #F0EFEA' }}>
                    <td style={{ padding: '6px 10px', textAlign: 'right' }}>{r.month}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', color: r.phase === '거치' ? '#8A8A85' : '#2A2925' }}>{r.phase}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right' }}>{fmt(r.payment)}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right' }}>{fmt(r.principal)}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right' }}>{fmt(r.interest)}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right' }}>{fmt(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p style={{ fontSize: 11, color: '#B0AEA5', margin: '14px 0 0' }}>* 원 단위 반올림 계산이라 실제 은행 상환표와 1~2원 오차가 있을 수 있습니다. 참고용입니다.</p>
      </div>
    </div>
  );
}
