'use client';

// app/kosme-score/page.js
// 중진공 정책자금 평가점수 계산기 — 회사 본부장(이은종)이 공유한 "중진공_정책자금 평가점수 산출표.xlsx"의
// 배점 구조를 그대로 옮김. 노란색 셀(선택/입력)만 고르면 자동 합산되던 엑셀을 인앱 계산기로 재구현.
// 총 100점 만점: 중점지원10 + 고용기여20 + 기술경영혁신25 + 글로벌화10 + 정책우대5 + 성장잠재력30.

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/session';
import AppHeader from '../components/AppHeader';

const SECTIONS = [
  {
    key: 'jungjeom', title: '[1] 중점지원', maxPoints: 10,
    indicators: [
      { key: 'innovGrowth', label: '혁신성장 분야', note: '확인자료: 혁신성장분야 분류표', options: [['해당', 5], ['미해당', 0]] },
      { key: 'firstDeal', label: '첫거래 기업', note: '확인자료: 통합정보시스템(대출정보)', options: [['첫거래', 5], ['기지원', 0]] },
    ],
  },
  {
    key: 'employment', title: '[2] 고용기여', maxPoints: 20,
    indicators: [
      { key: 'jobCreate', label: '고용창출 실적', note: '확인자료: 원천징수이행상황 신고서', options: [['10명 초과', 15], ['6~10명', 13], ['2~5명', 10], ['1명', 7], ['고용유지', 3], ['고용감소', 0]] },
      { key: 'jobKeep', label: '고용유지 실적', note: '확인자료: 관련 인증·가입건수', options: [['인재육성형·가족친화인증', 5], ['내일채움공제', 3], ['미해당', 0]] },
    ],
  },
  {
    key: 'techInnov', title: '[3] 기술·경영혁신', maxPoints: 25,
    indicators: [
      { key: 'ip3yr', label: '3년내 등록 지식재산권 (특허·실용신안)', note: '확인자료: 한국특허정보원 특허정보', options: [['4건 이상', 10], ['1~3건', 7], ['0건', 3]] },
      { key: 'techMgmt', label: '기술·경영 혁신분야', note: '확인자료: 융자공고 혁신형기업 기준 리스트', options: [['3건 이상', 15], ['2건', 13], ['1건', 10], ['0건', 5]] },
    ],
  },
  {
    key: 'global', title: '[4] 글로벌화', maxPoints: 10,
    indicators: [
      { key: 'exportRecord', label: '직수출 실적 (전년도)', note: '확인자료: 한국무역통계진흥원 직수출실적', options: [['100만불 초과', 10], ['10만불 초과~100만불 이하', 7], ['10만불 이하', 5], ['내수기업', 0]] },
    ],
  },
  {
    key: 'policy', title: '[5] 정책우대', maxPoints: 5,
    indicators: [
      { key: 'policyPref', label: '정부정책 우대기업', note: '확인자료: 융자공고 별표2 정책우대기업', options: [['1건 이상', 5], ['0건', 0]] },
    ],
  },
  {
    key: 'growth', title: '[6] 성장잠재력', maxPoints: 30,
    indicators: [
      { key: 'aiEval', label: 'AI평가 (K-Value 등급)', note: '확인자료: 인공지능평가(K-Value등급)', options: [['K1~K3', 30], ['K4~K6', 25], ['K7~K9', 20], ['K10~K11', 15], ['K12~K13', 10], ['미평가', 0]] },
    ],
  },
];

export default function KosmeScorePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [selections, setSelections] = useState({}); // { indicatorKey: pointValue }

  useEffect(() => {
    const s = getSession();
    if (!s) { router.push('/'); return; }
    setUser(s);
  }, []);

  const sectionTotals = useMemo(() => {
    return SECTIONS.map((sec) => {
      const total = sec.indicators.reduce((sum, ind) => sum + (selections[ind.key] ?? 0), 0);
      return { key: sec.key, total, max: sec.maxPoints };
    });
  }, [selections]);

  const grandTotal = sectionTotals.reduce((s, sec) => s + sec.total, 0);
  const answeredCount = Object.keys(selections).length;
  const totalIndicators = SECTIONS.reduce((s, sec) => s + sec.indicators.length, 0);

  if (!user) return null;

  const pick = (key, points) => setSelections((prev) => ({ ...prev, [key]: points }));

  return (
    <div style={{ minHeight: '100vh', background: '#F7F6F2' }}>
      <AppHeader user={user} />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 20px 80px' }}>
        <h2 style={{ color: '#1a1a2e', margin: '0 0 4px' }}>중진공 정책자금 평가점수 계산기</h2>
        <p style={{ fontSize: 13, color: '#8A8A85', margin: '0 0 20px' }}>중진공 여신심사 시 반영되는 100점 만점 평가배점 기준입니다. 항목을 고르면 자동 합산됩니다.</p>

        {/* 총점 요약 — 상단 고정 느낌으로 */}
        <div style={{
          background: '#1a1a2e', borderRadius: 16, padding: '22px 26px', marginBottom: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff',
        }}>
          <div>
            <p style={{ fontSize: 12, color: '#B9C2D9', margin: '0 0 4px' }}>총점 ({answeredCount}/{totalIndicators}개 입력됨)</p>
            <p style={{ fontSize: 32, fontWeight: 800, margin: 0 }}>{grandTotal}<span style={{ fontSize: 16, color: '#B9C2D9', fontWeight: 400 }}> / 100점</span></p>
          </div>
          <div style={{ width: 100, height: 100, borderRadius: '50%', border: '6px solid #3A4A7A', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <svg width="100" height="100" style={{ position: 'absolute', top: -6, left: -6, transform: 'rotate(-90deg)' }}>
              <circle cx="50" cy="50" r="47" fill="none" stroke="#D85A30" strokeWidth="6" strokeDasharray={`${(grandTotal / 100) * 295} 295`} strokeLinecap="round" />
            </svg>
            <span style={{ fontSize: 20, fontWeight: 700 }}>{grandTotal}%</span>
          </div>
        </div>

        {SECTIONS.map((sec) => {
          const secTotal = sectionTotals.find((s) => s.key === sec.key);
          return (
            <div key={sec.key} style={{ background: '#fff', borderRadius: 14, padding: '18px 20px', marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <p style={{ fontSize: 14.5, fontWeight: 700, color: '#2A2925', margin: 0 }}>{sec.title}</p>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#D85A30' }}>{secTotal.total} / {sec.maxPoints}점</span>
              </div>
              {sec.indicators.map((ind) => (
                <div key={ind.key} style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 13, color: '#2A2925', margin: '0 0 6px', fontWeight: 600 }}>{ind.label}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {ind.options.map(([label, points]) => {
                      const active = selections[ind.key] === points;
                      return (
                        <button
                          key={label}
                          onClick={() => pick(ind.key, points)}
                          style={{
                            padding: '7px 12px', borderRadius: 8, fontSize: 12.5, cursor: 'pointer',
                            border: active ? '1.5px solid #D85A30' : '1px solid #E0DFDA',
                            background: active ? '#FFF6F2' : '#fff',
                            color: active ? '#D85A30' : '#5F5E5A', fontWeight: active ? 700 : 400,
                          }}
                        >
                          {label} ({points}점)
                        </button>
                      );
                    })}
                  </div>
                  <p style={{ fontSize: 10.5, color: '#B0AEA5', margin: '5px 0 0' }}>{ind.note}</p>
                </div>
              ))}
            </div>
          );
        })}

        <button
          onClick={() => setSelections({})}
          style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #2A2925', background: '#fff', color: '#2A2925', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          전체 초기화
        </button>

        <p style={{ fontSize: 11, color: '#B0AEA5', margin: '16px 0 0' }}>
          * 이은종 본부장 공유 자료(중진공_정책자금 평가점수 산출표) 기준입니다. 실제 심사 결과는 기관 내부 심사 기준에 따라 달라질 수 있습니다.
        </p>
      </div>
    </div>
  );
}
