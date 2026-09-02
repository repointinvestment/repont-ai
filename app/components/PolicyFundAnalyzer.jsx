import { useState, useEffect } from "react";
import DateYMDInput from "./DateYMDInput";
import { analyzePolicyFunds } from "@/lib/policyFundAnalysis";
import { fetchPolicyFundsData } from "@/lib/policyFundsLookup";

const SMART_DEVICES = [
  "3D 풋스캐너 / 3D 프린터",
  "AI CCTV / AI 두피분석 / AI 안면인식",
  "AI·IOT 온도관리시스템",
  "주문·예약·결제 키오스크",
  "QR/NFC 오더 / 테이블 오더",
  "AI·무게형·모듈형 무인판매기",
  "서빙로봇 / 헬퍼로봇 / 조리로봇",
  "디지털광고보드 / 디지털메뉴보드",
  "고객관리·예약·매출분석·재고관리 S/W",
  "온라인예약관리 / 매장멤버십관리시스템",
  "축산 육가공공정시스템",
];

const INDUSTRIES = [
  "음식점·카페 (요식업)",
  "도소매업",
  "제조업",
  "건설업",
  "운수업",
  "서비스업 (미용·세탁·수선 등)",
  "정보통신업 (IT)",
  "교육서비스업",
  "부동산업",
  "농·수·임업",
  "기타",
];

const SOJINGONG_TYPES = [
  { key: "sinYong", label: "신용취약소상공인자금" },
  { key: "hyuksin", label: "혁신성장촉진자금" },
  { key: "jaedo", label: "재도전특별자금" },
  { key: "ilsi", label: "일시적경영애로자금" },
  { key: "etc", label: "기타 소진공 직접대출" },
];

const formatNum = (v) => {
  if (!v) return "";
  return Number(v.replace(/[^0-9]/g, "")).toLocaleString();
};
const parseNum = (v) => Number(String(v).replace(/[^0-9]/g, "")) || 0;

const sectionStyle = {
  background: "#FBF7EE", borderRadius: 4, padding: "26px 28px",
  marginBottom: 18, border: "1px solid #E2D9C4",
  boxShadow: "0 10px 30px rgba(11,36,64,0.18)",
};
const labelStyle = {
  display: "block", fontSize: 12.5, fontWeight: 600,
  color: "#5B4A2F", marginBottom: 6, letterSpacing: "0.01em",
};

// 모듈 최상단에 고정 선언 — 렌더링 함수 안에서 정의하면 매 키 입력마다
// 새 컴포넌트로 취급되어 입력창이 리마운트되며 포커스가 끊깁니다.
function Section({ num, icon, title, note, children }) {
  return (
    <div style={sectionStyle}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
        <span style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 13, color: "#B4923F", fontWeight: 700, letterSpacing: "0.05em" }}>
          제{num}항
        </span>
        <span style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 17, fontWeight: 700, color: "#1C2B3A" }}>
          {icon} {title}
        </span>
      </div>
      <div style={{ height: 1, background: "linear-gradient(90deg, #B4923F, transparent)", margin: "10px 0 18px" }} />
      {note && <p style={{ fontSize: 12, color: "#8A8272", marginTop: -12, marginBottom: 14 }}>{note}</p>}
      {children}
    </div>
  );
}

function YesNoField({ label, value, onChange }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: "flex", gap: 10 }}>
        {["yes", "no"].map((v) => {
          const active = value === v;
          const isYes = v === "yes";
          return (
            <button key={v} onClick={() => onChange(v)} style={{
              flex: 1, padding: "10px 8px", position: "relative",
              border: `1.5px solid ${active ? (isYes ? "#A23B2E" : "#8A8272") : "#E2D9C4"}`,
              borderRadius: 6,
              background: active ? (isYes ? "rgba(162,59,46,0.07)" : "rgba(90,80,60,0.06)") : "#FFFEFB",
              color: active ? (isYes ? "#A23B2E" : "#5B4A2F") : "#8A8272",
              fontSize: 13, fontWeight: 700, cursor: "pointer",
              fontFamily: "'Noto Sans KR', sans-serif",
              transition: "all 0.15s",
            }}>
              {active && isYes && <span style={{ marginRight: 4 }}>●</span>}
              {v === "yes" ? "있음" : "없음"}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function PolicyFundAnalyzer({ onAIAnalysis, initialData }) {
  const [form, setForm] = useState({
    industry: "",
    bizAge: "",
    sales: "",
    employees: "",
    creditKCB: "",
    creditNICE: "",
    sojingongLoans: { sinYong: "", hyuksin: "", jaedo: "", ilsi: "", etc: "" },
    loans: {
      jaedan: "",
      jaedanDate: "",
      jaedanRegion: "",
      shinbo: "",
      shinboDate: "",
      gibo: "",
      giboDate: "",
      jungjingong: "",
      bizCredit: "",
      personal1: "",
      personal2: "",
      cardLoan: "",
      cashService: "",
    },
    hasBankruptcy: "",
    currentBizCount: "",
    smartDevices: [],
    exportRecord: "",
    salesGrowth: "",
    taxDelinquent: "",
    hasPatent: "",
    careerYears: "",
    isFranchise: false,
  });

  // 고객 대시보드에서 넘어온 경우, 이미 입력된 정보로 폼을 채워줌 (한 번만 반영)
  useEffect(() => {
    if (!initialData) return;
    setForm((f) => ({
      ...f,
      ...initialData,
      sojingongLoans: { ...f.sojingongLoans, ...(initialData.sojingongLoans || {}) },
      loans: { ...f.loans, ...(initialData.loans || {}) },
    }));
  }, [initialData]);

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fundsByKey, setFundsByKey] = useState({});
  const [rulesByKey, setRulesByKey] = useState({});

  // 마스터 DB(lib/policyFundsSeed.js 기반) 자금/공통규칙을 한 번 받아둠 — analyze()가 여기서 한도·기준을 읽음
  useEffect(() => {
    fetchPolicyFundsData({ activeOnly: true })
      .then((data) => { setFundsByKey(data.fundsByKey); setRulesByKey(data.rulesByKey); })
      .catch(() => {});
  }, []);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));
  const setLoan = (key, val) => setForm((f) => ({ ...f, loans: { ...f.loans, [key]: val } }));
  const setSojingong = (key, val) => setForm((f) => ({ ...f, sojingongLoans: { ...f.sojingongLoans, [key]: val } }));
  const toggleDevice = (d) =>
    setForm((f) => ({
      ...f,
      smartDevices: f.smartDevices.includes(d)
        ? f.smartDevices.filter((x) => x !== d)
        : [...f.smartDevices, d],
    }));

  const analyze = () => {
    setLoading(true);
    setResult(null);

    // 2026-09-02: 판정 로직 자체는 lib/policyFundAnalysis.js(마스터 DB 기반)로 이관 —
    // 여기서는 폼 데이터를 넘기고, 결과에 institution 필드(기존 렌더링 코드가 필요로 함)만 덧붙임.
    const sharedResult = analyzePolicyFunds(
      {
        industry: form.industry,
        bizAge: form.bizAge,
        sales: form.sales,
        employees: form.employees,
        creditKCB: form.creditKCB,
        creditNICE: form.creditNICE,
        sojingongLoans: form.sojingongLoans,
        loans: form.loans,
        hasBankruptcy: form.hasBankruptcy,
        currentBizCount: form.currentBizCount,
        smartDevices: form.smartDevices,
        exportRecord: form.exportRecord,
        salesGrowth: form.salesGrowth,
        taxDelinquent: form.taxDelinquent,
        isFranchise: form.isFranchise,
        hasPatent: form.hasPatent === "yes",
        careerYears: form.careerYears,
      },
      fundsByKey,
      rulesByKey
    );

    const results = sharedResult.results.map((r) => ({
      ...r,
      institution: r.tag === "소진공 직접대출" ? "소진공" : r.name,
    }));

    // AI 분석용 고객 정보 요약 (customerSummary는 이 컴포넌트만 쓰므로 여기서 별도 계산)
    const bizAgeNum = parseNum(form.bizAge);
    const salesNum = parseNum(form.sales);
    const employeesNum = parseNum(form.employees);
    const creditKCB = parseNum(form.creditKCB);
    const creditNICE = parseNum(form.creditNICE);
    const sinYongLoan = parseNum(form.sojingongLoans.sinYong);
    const hyuksinLoan = parseNum(form.sojingongLoans.hyuksin);
    const jaedoLoan = parseNum(form.sojingongLoans.jaedo);
    const jaedanLoan = parseNum(form.loans.jaedan);
    const shinboLoan = parseNum(form.loans.shinbo);
    const giboLoan = parseNum(form.loans.gibo);
    const hasSmartDevice = form.smartDevices.length > 0;
    const customerSummary = `업종: ${form.industry}, 업력: ${bizAgeNum}년, 작년매출: ${salesNum.toLocaleString()}만원, 직원수: ${employeesNum}명, 신용점수: KCB ${creditKCB || "-"} / NICE ${creditNICE || "-"}, 소진공 대출: 신용취약 ${sinYongLoan}만원 / 혁신 ${hyuksinLoan}만원 / 재도전 ${jaedoLoan}만원, 신용보증재단: ${jaedanLoan}만원, 신보: ${shinboLoan}만원, 기보: ${giboLoan}만원, 폐업이력: ${form.hasBankruptcy === "yes" ? "있음" : "없음"}, 사업자수: ${form.currentBizCount || "-"}, 스마트기기: ${hasSmartDevice ? form.smartDevices.join(", ") : "없음"}, 수출: ${form.exportRecord === "yes" ? "있음" : "없음"}, 2년연속매출10%증가: ${form.salesGrowth === "yes" ? "있음" : "없음"}`;

    setResult({
      results,
      warnings: sharedResult.warnings,
      checks: sharedResult.checks,
      totalBizLoan: sharedResult.totalBizLoan,
      totalPersonalLoan: sharedResult.totalPersonalLoan,
      remainingCapacity: sharedResult.remainingCapacity,
      sojingongRemain: sharedResult.sojingongRemain,
      bizAgeNum: sharedResult.bizAgeNum,
      customerSummary,
    });
    setLoading(false);
  };

  const inputStyle = {
    width: "100%", padding: "11px 13px",
    border: "1.5px solid #E2D9C4", borderRadius: 6,
    fontSize: 14, boxSizing: "border-box", outline: "none",
    background: "#FFFEFB", color: "#1C2B3A",
    fontFamily: "'Noto Sans KR', sans-serif",
  };

  // 기관/자금별 개별 금액 파싱 (합산하지 않음 — 재단/신보/기보는 1개만 선택 가능하고,
  // 소진공 자금들은 같은 총한도 풀을 공유하므로 단순 합산은 실제와 다릅니다)
  const resultAmounts = result
    ? result.results.map((r) => {
        const m = r.limit.match(/[\d,]+/);
        return m ? Number(m[0].replace(/,/g, "")) : 0;
      })
    : [];
  const maxSingleAmount = resultAmounts.length > 0 ? Math.max(...resultAmounts) : 0;

  // 소진공(직접대출)과 보증기관(재단/신보/기보, 택1)은 서로 다른 방식이라 조합 가능하므로
  // 카테고리별 최고금액을 따로 계산해서 보여줍니다 (전체 합산이나 단일 최댓값은 오해 소지가 있음)
  const sojingongAmounts = result
    ? result.results.filter((r) => r.institution === "소진공").map((r, idx) => resultAmounts[result.results.indexOf(r)])
    : [];
  const guaranteeAmounts = result
    ? result.results.filter((r) => r.institution && r.institution !== "소진공").map((r) => resultAmounts[result.results.indexOf(r)]).filter((a) => a > 0)
    : [];
  const sojingongBest = sojingongAmounts.length > 0 ? Math.max(...sojingongAmounts) : 0;
  const guaranteeBest = guaranteeAmounts.length > 0 ? Math.max(...guaranteeAmounts) : 0;
  const hasGuaranteeNoAmount = result ? result.results.some((r) => r.institution && r.institution !== "소진공" && !resultAmounts[result.results.indexOf(r)]) : false;

  const INSTITUTION_ICONS = {
    "소진공": "🏛",
    "신용보증재단": "🏦",
    "신용보증기금(신보)": "💼",
    "기술보증기금(기보)": "🔬",
  };
  const groupedResults = [];
  if (result) {
    result.results.forEach((r, i) => {
      const key = r.institution || r.tag;
      let group = groupedResults.find((g) => g.key === key);
      if (!group) {
        group = { key, icon: INSTITUTION_ICONS[key] || "📋", items: [] };
        groupedResults.push(group);
      }
      group.items.push({ ...r, amount: resultAmounts[i] });
    });
  }

  return (
    <div style={{
      background: "linear-gradient(180deg, #0B2440 0%, #0E2C4C 100%)",
      borderRadius: 16, padding: "40px 0 56px",
      fontFamily: "'Noto Sans KR', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@500;700;900&family=Noto+Sans+KR:wght@400;500;600;700&display=swap');
        @keyframes pfHeroRise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pfStampIn {
          0% { opacity: 0; transform: scale(1.6) rotate(-24deg); }
          55% { opacity: 1; transform: scale(0.94) rotate(-11deg); }
          75% { transform: scale(1.04) rotate(-13deg); }
          100% { opacity: 1; transform: scale(1) rotate(-12deg); }
        }
        @keyframes pfCardIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .pf-hero { animation: pfHeroRise 0.6s ease both; }
        .pf-stamp { animation: pfStampIn 0.7s cubic-bezier(.2,1.4,.4,1) both; }
        .pf-card-in { animation: pfCardIn 0.45s ease both; }
      `}</style>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 24px" }}>

        {/* 히어로 */}
        <div className="pf-hero" style={{ textAlign: "center", marginBottom: 40 }}>
          <p style={{
            fontFamily: "'Noto Serif KR', serif", fontSize: 12, letterSpacing: "0.25em",
            color: "#B4923F", fontWeight: 700, marginBottom: 10,
          }}>
            자 금 비 서 · 정 책 자 금 진 단
          </p>
          <h1 style={{
            fontFamily: "'Noto Serif KR', serif", fontSize: "clamp(24px, 4vw, 34px)",
            color: "#FBF7EE", fontWeight: 700, margin: 0, lineHeight: 1.4,
          }}>
            지금, 받을 수 있는 정책자금은<br />얼마일까요?
          </h1>
          <p style={{ fontSize: 14, color: "#8FA6C0", marginTop: 12 }}>
            아래 정보를 입력하시면 실제 심사 기준으로 신청 가능한 자금을 진단해드립니다
          </p>
        </div>

        {/* 기본정보 */}
        <Section num="1" icon="📋" title="기본 정보">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={labelStyle}>업종</label>
              <select value={form.industry} onChange={(e) => set("industry", e.target.value)} style={{
                ...inputStyle,
                appearance: "none", WebkitAppearance: "none", MozAppearance: "none",
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='9' viewBox='0 0 14 9'%3E%3Cpath d='M1 1L7 7L13 1' stroke='%23B4923F' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center", paddingRight: 36,
              }}>
                <option value="">선택하세요</option>
                {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>업력 (년)</label>
              <input type="number" placeholder="예: 3" value={form.bizAge} onChange={(e) => set("bizAge", e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>작년 매출 (만원)</label>
              <input placeholder="예: 8,000" value={form.sales} onChange={(e) => set("sales", formatNum(e.target.value))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>직원 수 (4대보험, 대표자 제외)</label>
              <input type="number" placeholder="예: 2" value={form.employees} onChange={(e) => set("employees", e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>신용점수 — KCB</label>
              <input type="number" placeholder="예: 780" value={form.creditKCB} onChange={(e) => set("creditKCB", e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>신용점수 — NICE</label>
              <input type="number" placeholder="예: 750" value={form.creditNICE} onChange={(e) => set("creditNICE", e.target.value)} style={inputStyle} />
            </div>
          </div>
        </Section>

        {/* 소진공 직접대출 */}
        <Section num="2" icon="🏛" title="소진공 직접대출 현황 (만원)" note="※ 자금 종류별로 구분해서 입력하세요">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {SOJINGONG_TYPES.map(({ key, label }) => (
              <div key={key}>
                <label style={labelStyle}>{label}</label>
                <input placeholder="0" value={form.sojingongLoans[key]} onChange={(e) => setSojingong(key, formatNum(e.target.value))} style={inputStyle} />
              </div>
            ))}
          </div>
        </Section>

        {/* 기타 정책자금 */}
        <Section num="3" icon="🏦" title="기타 정책자금 및 사업자대출 (만원)" note="※ 매출초과차입금 계산에 포함됩니다">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ gridColumn: "1 / -1", background: "rgba(180,146,63,0.08)", borderRadius: 6, padding: 16, border: "1px solid #E2D9C4" }}>
              <label style={{ ...labelStyle, color: "#8A5A2E" }}>신용보증재단</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, alignItems: "end" }}>
                <div>
                  <label style={{ ...labelStyle, fontSize: 11.5 }}>잔액 (만원)</label>
                  <input placeholder="0" value={form.loans.jaedan} onChange={(e) => setLoan("jaedan", formatNum(e.target.value))} style={inputStyle} />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: 11.5 }}>최초 수령일</label>
                  <DateYMDInput value={form.loans.jaedanDate} onChange={(v) => setLoan("jaedanDate", v)} inputStyle={inputStyle} />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: 11.5 }}>사업장 지역</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    {["수도권", "지방"].map((v) => (
                      <button key={v} onClick={() => setLoan("jaedanRegion", v)} style={{
                        flex: 1, padding: "10px 6px",
                        border: `1.5px solid ${form.loans.jaedanRegion === v ? "#0B2440" : "#E2D9C4"}`,
                        borderRadius: 6, background: form.loans.jaedanRegion === v ? "#0B2440" : "#FFFEFB",
                        color: form.loans.jaedanRegion === v ? "#FBF7EE" : "#5B4A2F",
                        fontSize: 13, fontWeight: 600, cursor: "pointer",
                      }}>{v}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ background: "rgba(180,146,63,0.08)", borderRadius: 6, padding: 16, border: "1px solid #E2D9C4" }}>
              <label style={{ ...labelStyle, color: "#8A5A2E" }}>신용보증기금 (신보)</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "end" }}>
                <div>
                  <label style={{ ...labelStyle, fontSize: 11.5, minHeight: 30 }}>잔액 (만원)</label>
                  <input placeholder="0" value={form.loans.shinbo} onChange={(e) => setLoan("shinbo", formatNum(e.target.value))} style={inputStyle} />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: 11.5, minHeight: 30 }}>최초 수령일 <span style={{ fontWeight: 400 }}>(1년 경과해야 재신청)</span></label>
                  <DateYMDInput value={form.loans.shinboDate} onChange={(v) => setLoan("shinboDate", v)} inputStyle={inputStyle} />
                </div>
              </div>
            </div>

            <div style={{ background: "rgba(180,146,63,0.08)", borderRadius: 6, padding: 16, border: "1px solid #E2D9C4" }}>
              <label style={{ ...labelStyle, color: "#8A5A2E" }}>기술보증기금 (기보)</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "end" }}>
                <div>
                  <label style={{ ...labelStyle, fontSize: 11.5, minHeight: 30 }}>잔액 (만원)</label>
                  <input placeholder="0" value={form.loans.gibo} onChange={(e) => setLoan("gibo", formatNum(e.target.value))} style={inputStyle} />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: 11.5, minHeight: 30 }}>최초 수령일 <span style={{ fontWeight: 400 }}>(1년 경과해야 재신청)</span></label>
                  <DateYMDInput value={form.loans.giboDate} onChange={(v) => setLoan("giboDate", v)} inputStyle={inputStyle} />
                </div>
              </div>
            </div>

            {[
              { key: "jungjingong", label: "중진공" },
              { key: "bizCredit", label: "사업자 신용대출 (은행 담보·일반)" },
            ].map(({ key, label }) => (
              <div key={key}>
                <label style={labelStyle}>{label}</label>
                <input placeholder="0" value={form.loans[key]} onChange={(e) => setLoan(key, formatNum(e.target.value))} style={inputStyle} />
              </div>
            ))}
          </div>
        </Section>

        {/* 개인신용 */}
        <Section num="4" icon="💳" title="개인신용 대출 (만원)" note="※ 매출초과차입금 계산에서 제외됩니다 (참고용)">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[
              { key: "personal1", label: "1금융권 신용대출" },
              { key: "personal2", label: "2금융권 신용대출 (저축은행·캐피탈 등)" },
              { key: "cardLoan", label: "카드론" },
              { key: "cashService", label: "현금서비스" },
            ].map(({ key, label }) => (
              <div key={key}>
                <label style={labelStyle}>{label}</label>
                <input placeholder="0" value={form.loans[key]} onChange={(e) => setLoan(key, formatNum(e.target.value))} style={inputStyle} />
              </div>
            ))}
          </div>
        </Section>

        {/* 추가 조건 */}
        <Section num="5" icon="📌" title="추가 조건 확인">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <YesNoField label="국세·지방세 체납 여부" value={form.taxDelinquent} onChange={(v) => set("taxDelinquent", v)} />
            <YesNoField label="과거 폐업 이력" value={form.hasBankruptcy} onChange={(v) => set("hasBankruptcy", v)} />
            <YesNoField label="최근 1년 수출 실적 1천달러 이상" value={form.exportRecord} onChange={(v) => set("exportRecord", v)} />
            <YesNoField label="2년 연속 매출 10% 이상 증가" value={form.salesGrowth} onChange={(v) => set("salesGrowth", v)} />
            <div>
              <label style={labelStyle}>현재 사업자 수 (대표자 명의)</label>
              <div style={{ display: "flex", gap: 8 }}>
                {["1", "2+"].map((v) => (
                  <button key={v} onClick={() => set("currentBizCount", v)} style={{
                    flex: 1, padding: "10px 8px",
                    border: `1.5px solid ${form.currentBizCount === v ? "#0B2440" : "#E2D9C4"}`,
                    borderRadius: 6, background: form.currentBizCount === v ? "#0B2440" : "#FFFEFB",
                    color: form.currentBizCount === v ? "#FBF7EE" : "#5B4A2F",
                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                  }}>
                    {v === "1" ? "1개" : "2개 이상"}
                  </button>
                ))}
              </div>
            </div>
            <YesNoField label="특허 보유 여부 (기보 자격 확인용)" value={form.hasPatent} onChange={(v) => set("hasPatent", v)} />
            <div>
              <label style={labelStyle}>대표자 경력 (년, 기보 자격 확인용)</label>
              <input type="number" placeholder="예: 12" value={form.careerYears} onChange={(e) => set("careerYears", e.target.value)} style={inputStyle} />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#5B4A2F", fontWeight: 600 }}>
              <input type="checkbox" checked={form.isFranchise} onChange={(e) => set("isFranchise", e.target.checked)} />
              프랜차이즈·가맹점 (요식업인 경우 신보/기보 검토 대상 여부에 영향)
            </label>
          </div>
        </Section>

        {/* 스마트기기 */}
        <Section num="6" icon="🔧" title="스마트기기 보유 현황 (해당하는 것 모두 선택)">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {SMART_DEVICES.map((d) => (
              <button key={d} onClick={() => toggleDevice(d)} style={{
                padding: "8px 14px",
                border: `1.5px solid ${form.smartDevices.includes(d) ? "#0B2440" : "#E2D9C4"}`,
                borderRadius: 20, background: form.smartDevices.includes(d) ? "#0B2440" : "#FFFEFB",
                color: form.smartDevices.includes(d) ? "#FBF7EE" : "#5B4A2F",
                fontSize: 12.5, cursor: "pointer", fontWeight: form.smartDevices.includes(d) ? 700 : 500,
              }}>
                {d}
              </button>
            ))}
          </div>
        </Section>

        {/* 분석 버튼 */}
        <button onClick={analyze} disabled={loading || !form.industry} style={{
          width: "100%", padding: 18, marginTop: 6,
          background: loading || !form.industry ? "#3D4E63" : "linear-gradient(135deg, #A23B2E, #7E2C22)",
          color: "#FBF7EE", border: "none", borderRadius: 6,
          fontSize: 16, fontWeight: 700, letterSpacing: "0.05em",
          cursor: loading || !form.industry ? "not-allowed" : "pointer",
          marginBottom: 8,
          fontFamily: "'Noto Serif KR', serif",
          boxShadow: loading || !form.industry ? "none" : "0 8px 24px rgba(162,59,46,0.35)",
        }}>
          {loading ? "진단 중..." : "정책자금 진단 결과 확인하기"}
        </button>

        {/* 결과 */}
        {result && (
          <div style={{ marginTop: 36 }}>

            {/* 인증서 헤더 + 도장 */}
            <div className="pf-card-in" style={{
              background: "#FBF7EE", borderRadius: 4, padding: "36px 32px 30px",
              border: "1px solid #E2D9C4", position: "relative", overflow: "hidden",
              boxShadow: "0 16px 40px rgba(11,36,64,0.3)", marginBottom: 18, textAlign: "center",
            }}>
              {/* 네 귀퉁이 증서 장식 */}
              {[
                { top: 10, left: 10, borderWidth: "3px 0 0 3px" },
                { top: 10, right: 10, borderWidth: "3px 3px 0 0" },
                { bottom: 10, left: 10, borderWidth: "0 0 3px 3px" },
                { bottom: 10, right: 10, borderWidth: "0 3px 3px 0" },
              ].map((pos, i) => (
                <div key={i} style={{ position: "absolute", width: 20, height: 20, borderStyle: "solid", borderColor: "#B4923F", ...pos }} />
              ))}

              <p style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 12, letterSpacing: "0.3em", color: "#B4923F", fontWeight: 700, marginBottom: 10, position: "relative" }}>
                정 책 자 금 진 단 결 과
              </p>
              <p style={{
                fontFamily: "'Noto Serif KR', serif", fontSize: "clamp(18px, 3vw, 24px)", fontWeight: 700,
                color: "#0B2440", margin: 0, position: "relative", lineHeight: 1.6,
              }}>
                {sojingongBest > 0 && (guaranteeBest > 0 || hasGuaranteeNoAmount) ? (
                  <>
                    소진공 최대 <span style={{ color: "#A23B2E" }}>{sojingongBest.toLocaleString()}만원</span>
                    {" + "}보증기관(택1) {guaranteeBest > 0 ? <>최대 <span style={{ color: "#A23B2E" }}>{guaranteeBest.toLocaleString()}만원</span></> : "심사 시 결정"}
                  </>
                ) : sojingongBest > 0 ? (
                  <>소진공 최대 <span style={{ color: "#A23B2E" }}>{sojingongBest.toLocaleString()}만원</span>까지 신청 가능</>
                ) : guaranteeBest > 0 ? (
                  <>보증기관 최대 <span style={{ color: "#A23B2E" }}>{guaranteeBest.toLocaleString()}만원</span>까지 신청 가능</>
                ) : (
                  <>진단 결과를 확인해주세요</>
                )}
              </p>
              <p style={{ fontSize: 13, color: "#8A8272", marginTop: 10, position: "relative", lineHeight: 1.7 }}>
                신청 가능한 정책자금 {result.results.length}건 확인됨 — 재단·신보·기보 중에는 1개만,<br />
                소진공 직접대출은 별도로 함께 진행 가능하니 상담에서 순서를 안내해드려요
              </p>

              <div className="pf-stamp" style={{
                position: "absolute", top: 20, right: 24,
                width: 84, height: 84, borderRadius: "50%",
                border: "3px double #A23B2E", display: "flex", alignItems: "center", justifyContent: "center",
                color: "#A23B2E", transform: "rotate(-12deg)",
              }}>
                <div style={{ textAlign: "center", lineHeight: 1.2 }}>
                  <div style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 15, fontWeight: 900 }}>진단</div>
                  <div style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 15, fontWeight: 900 }}>완료</div>
                </div>
              </div>
            </div>

            {/* 기관별 비교 그래프 */}
            {result.results.length > 0 && (
              <div className="pf-card-in" style={{
                background: "#FBF7EE", borderRadius: 4, padding: "24px 28px",
                border: "1px solid #E2D9C4", marginBottom: 18,
                boxShadow: "0 10px 30px rgba(11,36,64,0.18)",
              }}>
                <p style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 15, fontWeight: 700, color: "#1C2B3A", margin: "0 0 4px" }}>
                  기관별 비교
                </p>
                <p style={{ fontSize: 12, color: "#8A8272", margin: "0 0 18px" }}>
                  하나를 선택하면 상담에서 자세히 안내해드려요
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
                  {groupedResults.map((group) => (
                    <div key={group.key}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: 17 }}>{group.icon}</span>
                        <span style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 14, fontWeight: 700, color: "#8A5A2E" }}>{group.key}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingLeft: 4, borderLeft: "2px solid #E2D9C4", marginLeft: 8 }}>
                        {group.items.map((r, i) => {
                          const pct = r.cap ? (r.amount / r.cap) * 100 : (r.amount > 0 ? 100 : 0);
                          return (
                            <div key={i} style={{ paddingLeft: 12 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: "#1C2B3A" }}>{r.name}</span>
                                <span style={{ fontSize: 14, fontWeight: 800, color: r.color }}>{r.limit}</span>
                              </div>
                              <div style={{ height: 10, background: "#EFE8D6", borderRadius: 20, overflow: "hidden" }}>
                                <div style={{ width: `${pct}%`, height: "100%", background: r.color, borderRadius: 20, transition: "width 0.6s ease" }} />
                              </div>
                              <p style={{ fontSize: 11, color: "#B0AEA5", margin: "3px 0 0" }}>
                                {r.cap ? `총한도 ${r.cap.toLocaleString()}만원 중 ${Math.round(pct)}% 신청 가능` : "매출 등 기준에 따라 산정된 금액"}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.warnings.length > 0 && (
              <div className="pf-card-in" style={{ background: "#F5E3DF", border: "1px solid #D9A99C", borderRadius: 4, padding: "16px 20px", marginBottom: 14 }}>
                {result.warnings.map((w, i) => <p key={i} style={{ margin: i > 0 ? "8px 0 0" : 0, fontSize: 13.5, color: "#8A2A1F", fontWeight: 600 }}>{w}</p>)}
              </div>
            )}
            {result.checks.length > 0 && (
              <div className="pf-card-in" style={{ background: "#F6F1E3", border: "1px solid #D9CC9F", borderRadius: 4, padding: "16px 20px", marginBottom: 14 }}>
                {result.checks.map((c, i) => <p key={i} style={{ margin: i > 0 ? "8px 0 0" : 0, fontSize: 13.5, color: "#4A3A20", fontWeight: 500 }}>{c}</p>)}
              </div>
            )}
            {result.bizAgeNum >= 7 && (
              <div className="pf-card-in" style={{ background: "#E4EAF1", border: "1px solid #B7C4D6", borderRadius: 4, padding: "16px 20px", marginBottom: 14 }}>
                <p style={{ margin: 0, fontSize: 13.5, color: "#0B2440", fontWeight: 700 }}>매출초과차입금 계산</p>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "#264569", fontWeight: 500 }}>사업자대출 합계 {result.totalBizLoan.toLocaleString()}만원 · 잔여 가능 {result.remainingCapacity.toLocaleString()}만원</p>
                {result.totalPersonalLoan > 0 && <p style={{ margin: "4px 0 0", fontSize: 12, color: "#5B6B80" }}>개인신용대출 {result.totalPersonalLoan.toLocaleString()}만원은 계산 제외</p>}
              </div>
            )}

            {result.results.length > 0 ? (
              <div>
                {groupedResults.map((group, gi) => (
                  <div key={group.key} style={{ marginBottom: gi < groupedResults.length - 1 ? 18 : 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, paddingLeft: 4 }}>
                      <span style={{ fontSize: 18 }}>{group.icon}</span>
                      <span style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 15, fontWeight: 700, color: "#FBF7EE" }}>{group.key}</span>
                    </div>
                    <div style={{ background: "#FBF7EE", borderRadius: 4, border: "1px solid #E2D9C4", overflow: "hidden", boxShadow: "0 10px 30px rgba(11,36,64,0.18)" }}>
                      {group.items.map((r, i) => (
                        <div key={i} className="pf-card-in" style={{
                          padding: "20px 26px",
                          borderBottom: i < group.items.length - 1 ? "1px solid #E2D9C4" : "none",
                          animationDelay: `${i * 0.06}s`,
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                            <div>
                              <p style={{ margin: 0, fontFamily: "'Noto Serif KR', serif", fontSize: 12, color: "#B4923F", fontWeight: 700 }}>
                                {r.tag}
                              </p>
                              <p style={{ margin: "4px 0 0", fontSize: 17, fontWeight: 700, color: "#1C2B3A", fontFamily: "'Noto Serif KR', serif" }}>{r.name}</p>
                            </div>
                            <p style={{ margin: 0, fontSize: 19, fontWeight: 800, color: r.color, whiteSpace: "nowrap" }}>{r.limit}</p>
                          </div>
                          <div style={{ display: "flex", gap: 20, marginTop: 10 }}>
                            <p style={{ margin: 0, fontSize: 12.5, color: "#8A8272" }}>금리 <span style={{ color: "#3D4E63", fontWeight: 600 }}>{r.rate}</span></p>
                            <p style={{ margin: 0, fontSize: 12.5, color: "#8A8272" }}>상환기간 <span style={{ color: "#3D4E63", fontWeight: 600 }}>{r.period}</span></p>
                          </div>
                          <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "#5B4A2F" }}>✅ {r.condition}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="pf-card-in" style={{ background: "#FBF7EE", borderRadius: 4, padding: 28, textAlign: "center", border: "1px solid #E2D9C4" }}>
                <p style={{ fontSize: 15, color: "#5B4A2F" }}>입력하신 정보로는 해당되는 자금이 없습니다.</p>
                <p style={{ fontSize: 13, color: "#8A8272", marginTop: 8 }}>리포인트파트너스에 문의하시면 추가 방법을 안내해드립니다.</p>
              </div>
            )}

            {/* AI 심층 분석 버튼 */}
            {onAIAnalysis && (
              <button onClick={() => onAIAnalysis(result.customerSummary)} style={{
                width: "100%", padding: 17, marginTop: 16,
                background: "linear-gradient(135deg, #0B2440, #15304F)",
                color: "#FBF7EE", border: "1px solid #B4923F", borderRadius: 6,
                fontSize: 15.5, fontWeight: 700, cursor: "pointer",
                boxShadow: "0 8px 24px rgba(11,36,64,0.35)",
                fontFamily: "'Noto Serif KR', serif",
              }}>
                🤖 AI 심층 분석 받기 →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
