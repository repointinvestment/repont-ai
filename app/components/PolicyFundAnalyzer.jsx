import { useState } from "react";

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

export default function PolicyFundAnalyzer({ onAIAnalysis }) {
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

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

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

    const bizAgeNum = parseNum(form.bizAge);
    const salesNum = parseNum(form.sales);
    const employeesNum = parseNum(form.employees);
    const creditKCB = parseNum(form.creditKCB);
    const creditNICE = parseNum(form.creditNICE);

    // 소진공 각 자금별 잔액
    const sinYongLoan = parseNum(form.sojingongLoans.sinYong);
    const hyuksinLoan = parseNum(form.sojingongLoans.hyuksin);
    const jaedoLoan = parseNum(form.sojingongLoans.jaedo);
    const ilsiLoan = parseNum(form.sojingongLoans.ilsi);
    const etcLoan = parseNum(form.sojingongLoans.etc);
    const totalSojingong = sinYongLoan + hyuksinLoan + jaedoLoan + ilsiLoan + etcLoan;

    const jaedanLoan = parseNum(form.loans.jaedan);
    const shinboLoan = parseNum(form.loans.shinbo);
    const giboLoan = parseNum(form.loans.gibo);
    const jungjingongLoan = parseNum(form.loans.jungjingong);
    const bizCreditLoan = parseNum(form.loans.bizCredit);
    const personal1 = parseNum(form.loans.personal1);
    const personal2 = parseNum(form.loans.personal2);
    const cardLoan = parseNum(form.loans.cardLoan);
    const cashService = parseNum(form.loans.cashService);

    const totalBizLoan = totalSojingong + jaedanLoan + shinboLoan + giboLoan + jungjingongLoan + bizCreditLoan;
    const totalPersonalLoan = personal1 + personal2 + cardLoan + cashService;
    const remainingCapacity = salesNum - totalBizLoan;

    // 소진공 잔여한도 계산
    const sojingongRemain = Math.max(0, 10000 - totalSojingong);
    const sojingongRemainHyuksin = Math.max(0, 20000 - totalSojingong);

    // 신용취약 추가 가능 여부 (이미 3천 다 쓰면 불가)
    const sinYongAvailable = sinYongLoan < 3000;

    // 재단 재신청 가능 여부 계산
    let jaedanCanReapply = true;
    let jaedanReapplyMsg = "";
    if (jaedanLoan > 0 && form.loans.jaedanDate) {
      const receivedDate = new Date(form.loans.jaedanDate);
      const today = new Date();
      const diffMonths = (today.getFullYear() - receivedDate.getFullYear()) * 12 + (today.getMonth() - receivedDate.getMonth());
      const requiredMonths = form.loans.jaedanRegion === "수도권" ? 12 : 6;
      jaedanCanReapply = diffMonths >= requiredMonths;
      if (!jaedanCanReapply) {
        const remaining = requiredMonths - diffMonths;
        jaedanReapplyMsg = `재단 재신청 불가 — ${form.loans.jaedanRegion === "수도권" ? "수도권 1년" : "지방 6개월"} 기준 미충족 (약 ${remaining}개월 후 가능)`;
      } else {
        jaedanReapplyMsg = `재단 재신청 가능 ✅ (${form.loans.jaedanRegion === "수도권" ? "수도권 1년" : "지방 6개월"} 경과)`;
      }
    }

    const results = [];
    const warnings = [];
    const checks = [];

    const isManufacturing = form.industry.includes("제조") || form.industry.includes("건설") || form.industry.includes("운수");
    const maxEmployees = isManufacturing ? 9 : 4;
    const isRestaurant = form.industry.includes("음식점") || form.industry.includes("카페");
    const isFranchiseFood = isRestaurant && form.isFranchise;
    const isRetail = form.industry.includes("도소매");
    const isManuf = form.industry.includes("제조");

    if (employeesNum > maxEmployees) {
      warnings.push(`⚠️ ${form.industry} 기준 소상공인 상한 ${maxEmployees}명 초과 (현재 ${employeesNum}명) → 정책자금 신청 불가`);
    }
    if (form.taxDelinquent === "yes") {
      warnings.push("⚠️ 국세·지방세 체납 중 → 정책자금 신청 불가 (체납 해소 후 신청 가능)");
    }
    if (bizAgeNum >= 7) {
      if (remainingCapacity < 0) {
        warnings.push(`⚠️ 업력 ${bizAgeNum}년 (7년 이상) — 매출 ${salesNum.toLocaleString()}만원 - 사업자대출 ${totalBizLoan.toLocaleString()}만원 = ${remainingCapacity.toLocaleString()}만원 → 매출초과차입금 기준 초과, 신청 불가`);
      } else {
        checks.push(`✅ 업력 ${bizAgeNum}년 (7년 이상) — 매출초과차입금 여유 ${remainingCapacity.toLocaleString()}만원`);
      }
    } else {
      checks.push(`✅ 업력 ${bizAgeNum}년 (7년 미만) — 매출초과차입금 기준 미적용`);
    }

    if (jaedanReapplyMsg) {
      jaedanCanReapply ? checks.push(jaedanReapplyMsg) : warnings.push(`⚠️ ${jaedanReapplyMsg}`);
    }

    const canApply = form.taxDelinquent !== "yes" && employeesNum <= maxEmployees && (bizAgeNum < 7 || remainingCapacity >= 0);
    const hasSmartDevice = form.smartDevices.length > 0;
    const creditScore = creditKCB || creditNICE;

    // 혁신성장촉진자금 일반형
    if (canApply && hasSmartDevice && sojingongRemain > 0) {
      results.push({
        tag: "소진공 직접대출",
        name: "혁신성장촉진자금 일반형",
        limit: `최대 ${Math.min(sojingongRemain, 10000).toLocaleString()}만원`,
        rate: "정책자금 기준금리 + 0.4%p",
        period: "운전 5년 (거치 2년) / 시설 8년 (거치 3년)",
        condition: `스마트기기 보유 ✅ | 소진공 잔여한도 ${sojingongRemain.toLocaleString()}만원`,
        color: "#0f3460",
        institution: "소진공",
      });
    }
    if (!hasSmartDevice && canApply) {
      checks.push(`💡 스마트기기 보유 시 혁신성장촉진자금 신청이 가능합니다. 현재는 보유 스마트기기가 없어 대상이 아닙니다.`);
    }

    // 혁신성장촉진자금 혁신형
    const isHyuksin = form.exportRecord === "yes" || form.salesGrowth === "yes";
    if (canApply && isHyuksin && hasSmartDevice && sojingongRemainHyuksin > 0) {
      results.push({
        tag: "소진공 직접대출",
        name: "혁신성장촉진자금 혁신형",
        limit: `최대 ${Math.min(sojingongRemainHyuksin, 20000).toLocaleString()}만원`,
        rate: "정책자금 기준금리 + 0.4%p",
        period: "운전 5년 (거치 2년) / 시설 8년 (거치 3년)",
        condition: form.exportRecord === "yes" ? "수출 실적 1천달러 이상 ✅" : "2년 연속 매출 10% 증가 ✅",
        color: "#0f3460",
        institution: "소진공",
      });
    }

    // 재도전특별자금
    if (canApply && form.hasBankruptcy === "yes" && form.currentBizCount === "1" && bizAgeNum < 7 && sojingongRemain > 0) {
      results.push({
        tag: "소진공 직접대출",
        name: "재도전특별자금 일반형",
        limit: `최대 ${Math.min(sojingongRemain, 7000).toLocaleString()}만원`,
        rate: "정책자금 기준금리 + 0.4%p",
        period: "운전 5년 (거치 2년) / 시설 8년 (거치 3년)",
        condition: "폐업이력 ✅ + 사업자 1개 ✅ + 업력 7년 미만 ✅",
        color: "#0f3460",
        institution: "소진공",
      });
    }

    // 신용취약소상공인
    const creditEligible = creditScore >= 595 && creditScore <= 839;
    if (canApply && sinYongAvailable && creditEligible) {
      const remaining = 3000 - sinYongLoan;
      results.push({
        tag: "소진공 직접대출",
        name: "신용취약소상공인자금",
        limit: `최대 ${remaining.toLocaleString()}만원`,
        rate: "정책자금 기준금리 + 0.4%p",
        period: "5년 (거치 2년)",
        condition: `신용점수 ${creditScore}점 (595~839점 해당) ✅ | 잔여한도 ${remaining.toLocaleString()}만원`,
        color: "#1565c0",
        institution: "소진공",
      });
    } else {
      if (!sinYongAvailable) {
        warnings.push("⚠️ 신용취약소상공인자금 — 3,000만원 한도 소진으로 추가 신청 불가");
      }
      if (creditScore > 839) {
        warnings.push(`⚠️ 신용취약소상공인자금 — 신용점수 ${creditScore}점으로 대상 범위(595~839점) 초과, 신청 불가`);
      }
      if (creditScore > 0 && creditScore < 595) {
        warnings.push(`⚠️ 신용취약소상공인자금 — 신용점수 ${creditScore}점으로 최저 기준(595점) 미달, 신청 불가`);
      }
    }

    // 신용보증재단
    const jaedanRemain = Math.max(0, 10000 - jaedanLoan);
    if (canApply && jaedanRemain > 0 && jaedanCanReapply) {
      results.push({
        tag: "간접대출 (보증)",
        name: "신용보증재단",
        limit: `최대 ${jaedanRemain.toLocaleString()}만원`,
        rate: "은행 대출금리 적용",
        period: "은행별 상이",
        condition: `잔여 보증한도 ${jaedanRemain.toLocaleString()}만원 ※ 재단/신보/기보 중 1개만 선택`,
        color: "#2e7d32",
        institution: "신용보증재단",
      });
    }

    // 신보 재신청 가능 여부
    let shinboCanReapply = true;
    if (shinboLoan > 0 && form.loans.shinboDate) {
      const shinboDate = new Date(form.loans.shinboDate);
      const today = new Date();
      const diffMonths = (today.getFullYear() - shinboDate.getFullYear()) * 12 + (today.getMonth() - shinboDate.getMonth());
      shinboCanReapply = diffMonths >= 12;
      if (!shinboCanReapply) {
        const remaining = 12 - diffMonths;
        warnings.push(`⚠️ 신용보증기금 재신청 불가 — 1년 기준 미충족 (약 ${remaining}개월 후 가능)`);
      } else {
        checks.push(`✅ 신용보증기금 재신청 가능 (1년 경과)`);
      }
    }

    // 기보 재신청 가능 여부
    let giboCanReapply = true;
    if (giboLoan > 0 && form.loans.giboDate) {
      const giboDate = new Date(form.loans.giboDate);
      const today = new Date();
      const diffMonths = (today.getFullYear() - giboDate.getFullYear()) * 12 + (today.getMonth() - giboDate.getMonth());
      giboCanReapply = diffMonths >= 12;
      if (!giboCanReapply) {
        const remaining = 12 - diffMonths;
        warnings.push(`⚠️ 기술보증기금 재신청 불가 — 1년 기준 미충족 (약 ${remaining}개월 후 가능)`);
      } else {
        checks.push(`✅ 기술보증기금 재신청 가능 (1년 경과)`);
      }
    }

    // 신보 (일반 식당은 원칙적으로 대상 아님. 프랜차이즈·가맹점은 매출 기준으로 검토 가능)
    if (canApply && shinboCanReapply && (!isRestaurant || isFranchiseFood) && ((isRetail && salesNum >= 50000) || (isManuf && salesNum >= 30000) || (isFranchiseFood && salesNum >= 50000))) {
      const shinboLimit = isManuf ? Math.floor(salesNum / 4) : Math.floor(salesNum / 6);
      results.push({
        tag: "간접대출 (보증)",
        name: "신용보증기금 (신보)",
        limit: `최대 ${shinboLimit.toLocaleString()}만원`,
        rate: "은행 대출금리 적용",
        period: "은행별 상이",
        condition: `매출 ÷ ${isManuf ? 4 : 6} = ${shinboLimit.toLocaleString()}만원 ※ 재단/신보/기보 중 1개만 선택`,
        color: "#2e7d32",
        institution: "신용보증기금(신보)",
      });
    }
    if (isRestaurant && !isFranchiseFood) {
      checks.push("ℹ️ 신용보증기금·기술보증기금은 요식업 특성상 대상 업종이 아닙니다 (프랜차이즈·가맹점은 별도 검토 가능)");
    }

    // 기보: 핵심 조건은 특허보유 또는 대표자 경력 10년 이상 (매출/업종 기준 아님)
    const careerYearsNum = parseNum(form.careerYears);
    const giboCore = [];
    if (form.hasPatent === "yes") giboCore.push("특허보유");
    if (careerYearsNum >= 10) giboCore.push(`대표자 경력 ${careerYearsNum}년`);
    if (canApply && giboCanReapply && (!isRestaurant || isFranchiseFood) && giboCore.length > 0) {
      const giboRemainAmt = Math.max(0, 10000 - giboLoan);
      results.push({
        tag: "간접대출 (보증)",
        name: "기술보증기금 (기보)",
        limit: giboRemainAmt > 0 ? `잔여 보증한도 ${giboRemainAmt.toLocaleString()}만원` : "금액 상담 필요",
        rate: "은행 대출금리 적용",
        period: "은행별 상이",
        condition: `충족 요건: ${giboCore.join(", ")} ※ 재단/신보/기보 중 1개만 선택`,
        color: "#6a1b9a",
        institution: "기술보증기금(기보)",
      });
    } else if (canApply && (!isRestaurant || isFranchiseFood) && giboCore.length === 0) {
      checks.push("ℹ️ 기술보증기금(기보) — 특허보유 또는 대표자 경력 10년 이상 조건 확인 필요");
    }

    // 중진공: 정확한 심사 기준 미확정 — 별도 상담 필요로만 안내
    if (canApply) {
      checks.push("ℹ️ 중진공(중소벤처기업진흥공단) — 기준 확인 필요, 상담 시 별도 검토");
    }

    // AI 분석용 고객 정보 요약
    const hasSojingongResult = results.some((r) => r.tag === "소진공 직접대출");
    const hasGuaranteeResult = results.some((r) => r.tag === "간접대출 (보증)");
    if (hasSojingongResult && hasGuaranteeResult) {
      checks.push("💡 소진공 직접대출(직접대출)과 재단·신보·기보(간접대출/보증)는 서로 다른 방식이라 타이밍만 맞으면 함께 진행 가능합니다 — 진행 순서는 상담에서 안내해드립니다.");
    }

    const customerSummary = `업종: ${form.industry}, 업력: ${bizAgeNum}년, 작년매출: ${salesNum.toLocaleString()}만원, 직원수: ${employeesNum}명, 신용점수: KCB ${creditKCB || "-"} / NICE ${creditNICE || "-"}, 소진공 대출: 신용취약 ${sinYongLoan}만원 / 혁신 ${hyuksinLoan}만원 / 재도전 ${jaedoLoan}만원, 신용보증재단: ${jaedanLoan}만원, 신보: ${shinboLoan}만원, 기보: ${giboLoan}만원, 폐업이력: ${form.hasBankruptcy === "yes" ? "있음" : "없음"}, 사업자수: ${form.currentBizCount || "-"}, 스마트기기: ${hasSmartDevice ? form.smartDevices.join(", ") : "없음"}, 수출: ${form.exportRecord === "yes" ? "있음" : "없음"}, 2년연속매출10%증가: ${form.salesGrowth === "yes" ? "있음" : "없음"}`;

    setResult({ results, warnings, checks, totalBizLoan, totalPersonalLoan, remainingCapacity, sojingongRemain, bizAgeNum, customerSummary });
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
              <select value={form.industry} onChange={(e) => set("industry", e.target.value)} style={inputStyle}>
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
                  <input type="date" value={form.loans.jaedanDate} onChange={(e) => setLoan("jaedanDate", e.target.value)} style={inputStyle} />
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
                  <input type="date" value={form.loans.shinboDate} onChange={(e) => setLoan("shinboDate", e.target.value)} style={inputStyle} />
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
                  <input type="date" value={form.loans.giboDate} onChange={(e) => setLoan("giboDate", e.target.value)} style={inputStyle} />
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
                fontFamily: "'Noto Serif KR', serif", fontSize: "clamp(20px, 3.4vw, 27px)", fontWeight: 700,
                color: "#0B2440", margin: 0, position: "relative", lineHeight: 1.5,
              }}>
                최대 <span style={{ color: "#A23B2E" }}>{maxSingleAmount.toLocaleString()}만원</span>까지 신청 가능
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
                          const pct = maxSingleAmount > 0 ? (r.amount / maxSingleAmount) * 100 : 0;
                          return (
                            <div key={i} style={{ paddingLeft: 12 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: "#1C2B3A" }}>{r.name}</span>
                                <span style={{ fontSize: 14, fontWeight: 800, color: r.color }}>{r.limit}</span>
                              </div>
                              <div style={{ height: 10, background: "#EFE8D6", borderRadius: 20, overflow: "hidden" }}>
                                <div style={{ width: `${pct}%`, height: "100%", background: r.color, borderRadius: 20, transition: "width 0.6s ease" }} />
                              </div>
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
