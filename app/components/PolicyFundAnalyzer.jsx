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

    // 신보
    if (canApply && shinboCanReapply && !isRestaurant && ((isRetail && salesNum >= 50000) || (isManuf && salesNum >= 30000))) {
      const shinboLimit = isManuf ? Math.floor(salesNum / 4) : Math.floor(salesNum / 6);
      results.push({
        tag: "간접대출 (보증)",
        name: "신용보증기금 (신보)",
        limit: `최대 ${shinboLimit.toLocaleString()}만원`,
        rate: "은행 대출금리 적용",
        period: "은행별 상이",
        condition: `매출 ÷ ${isManuf ? 4 : 6} = ${shinboLimit.toLocaleString()}만원 ※ 재단/신보/기보 중 1개만 선택`,
        color: "#2e7d32",
      });
    }
    if (isRestaurant) {
      checks.push("ℹ️ 신용보증기금·기술보증기금은 요식업 특성상 대상 업종이 아닙니다");
    }

    // AI 분석용 고객 정보 요약
    const customerSummary = `업종: ${form.industry}, 업력: ${bizAgeNum}년, 작년매출: ${salesNum.toLocaleString()}만원, 직원수: ${employeesNum}명, 신용점수: KCB ${creditKCB || "-"} / NICE ${creditNICE || "-"}, 소진공 대출: 신용취약 ${sinYongLoan}만원 / 혁신 ${hyuksinLoan}만원 / 재도전 ${jaedoLoan}만원, 신용보증재단: ${jaedanLoan}만원, 신보: ${shinboLoan}만원, 기보: ${giboLoan}만원, 폐업이력: ${form.hasBankruptcy === "yes" ? "있음" : "없음"}, 사업자수: ${form.currentBizCount || "-"}, 스마트기기: ${hasSmartDevice ? form.smartDevices.join(", ") : "없음"}, 수출: ${form.exportRecord === "yes" ? "있음" : "없음"}, 2년연속매출10%증가: ${form.salesGrowth === "yes" ? "있음" : "없음"}`;

    setResult({ results, warnings, checks, totalBizLoan, totalPersonalLoan, remainingCapacity, sojingongRemain, bizAgeNum, customerSummary });
    setLoading(false);
  };

  const inputStyle = { width: "100%", padding: "10px 12px", border: "1.5px solid #e0e0e0", borderRadius: 8, fontSize: 14, boxSizing: "border-box", outline: "none", background: "white" };
  const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, color: "#444", marginBottom: 6 };
  const sectionStyle = { background: "white", borderRadius: 12, padding: "20px 24px", marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" };
  const sectionTitle = { fontSize: 15, fontWeight: 700, color: "#0f3460", marginBottom: 16, paddingBottom: 10, borderBottom: "2px solid #f0f0f0" };

  const YesNoBtn = ({ field, label }) => (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: "flex", gap: 8 }}>
        {["yes", "no"].map((v) => (
          <button key={v} onClick={() => set(field, v)} style={{
            flex: 1, padding: "9px",
            border: `1.5px solid ${form[field] === v ? "#0f3460" : "#e0e0e0"}`,
            borderRadius: 8, background: form[field] === v ? "#0f3460" : "white",
            color: form[field] === v ? "white" : "#666", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>
            {v === "yes" ? "있음" : "없음"}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ padding: "24px 0", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        {/* 기본정보 */}
        <div style={sectionStyle}>
          <div style={sectionTitle}>📋 기본 정보</div>
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
        </div>

        {/* 소진공 직접대출 */}
        <div style={sectionStyle}>
          <div style={sectionTitle}>🏛️ 소진공 직접대출 현황 (만원)</div>
          <p style={{ fontSize: 12, color: "#888", marginTop: -8, marginBottom: 14 }}>※ 자금 종류별로 구분해서 입력하세요</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {SOJINGONG_TYPES.map(({ key, label }) => (
              <div key={key}>
                <label style={labelStyle}>{label}</label>
                <input placeholder="0" value={form.sojingongLoans[key]} onChange={(e) => setSojingong(key, formatNum(e.target.value))} style={{ ...inputStyle, borderColor: "#cce0ff" }} />
              </div>
            ))}
          </div>
        </div>

        {/* 기대출 - 기타 정책자금 */}
        <div style={sectionStyle}>
          <div style={sectionTitle}>🏦 기타 정책자금 및 사업자대출 (만원)</div>
          <p style={{ fontSize: 12, color: "#888", marginTop: -8, marginBottom: 14 }}>※ 매출초과차입금 계산에 포함됩니다</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

            {/* 재단 - 날짜/지역 포함 */}
            <div style={{ gridColumn: "1 / -1", background: "#f8f9ff", borderRadius: 10, padding: 16 }}>
              <label style={{ ...labelStyle, color: "#0f3460" }}>신용보증재단</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ ...labelStyle, fontSize: 12 }}>잔액 (만원)</label>
                  <input placeholder="0" value={form.loans.jaedan} onChange={(e) => setLoan("jaedan", formatNum(e.target.value))} style={{ ...inputStyle, borderColor: "#cce0ff" }} />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: 12 }}>최초 수령일</label>
                  <input type="date" value={form.loans.jaedanDate} onChange={(e) => setLoan("jaedanDate", e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: 12 }}>사업장 지역</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    {["수도권", "지방"].map((v) => (
                      <button key={v} onClick={() => setLoan("jaedanRegion", v)} style={{
                        flex: 1, padding: "10px 6px",
                        border: `1.5px solid ${form.loans.jaedanRegion === v ? "#0f3460" : "#e0e0e0"}`,
                        borderRadius: 8, background: form.loans.jaedanRegion === v ? "#0f3460" : "white",
                        color: form.loans.jaedanRegion === v ? "white" : "#666",
                        fontSize: 13, fontWeight: 600, cursor: "pointer",
                      }}>{v}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 신보 */}
            <div style={{ background: "#f8f9ff", borderRadius: 10, padding: 16 }}>
              <label style={{ ...labelStyle, color: "#0f3460" }}>신용보증기금 (신보)</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ ...labelStyle, fontSize: 12 }}>잔액 (만원)</label>
                  <input placeholder="0" value={form.loans.shinbo} onChange={(e) => setLoan("shinbo", formatNum(e.target.value))} style={{ ...inputStyle, borderColor: "#cce0ff" }} />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: 12 }}>최초 수령일 (1년 경과해야 재신청)</label>
                  <input type="date" value={form.loans.shinboDate} onChange={(e) => setLoan("shinboDate", e.target.value)} style={inputStyle} />
                </div>
              </div>
            </div>

            {/* 기보 */}
            <div style={{ background: "#f8f9ff", borderRadius: 10, padding: 16 }}>
              <label style={{ ...labelStyle, color: "#0f3460" }}>기술보증기금 (기보)</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ ...labelStyle, fontSize: 12 }}>잔액 (만원)</label>
                  <input placeholder="0" value={form.loans.gibo} onChange={(e) => setLoan("gibo", formatNum(e.target.value))} style={{ ...inputStyle, borderColor: "#cce0ff" }} />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: 12 }}>최초 수령일 (1년 경과해야 재신청)</label>
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
                <input placeholder="0" value={form.loans[key]} onChange={(e) => setLoan(key, formatNum(e.target.value))} style={{ ...inputStyle, borderColor: "#cce0ff" }} />
              </div>
            ))}
          </div>
        </div>

        {/* 기대출 - 개인신용 */}
        <div style={sectionStyle}>
          <div style={sectionTitle}>💳 개인신용 대출 (만원)</div>
          <p style={{ fontSize: 12, color: "#888", marginTop: -8, marginBottom: 14 }}>※ 매출초과차입금 계산에서 제외됩니다 (참고용)</p>
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
        </div>

        {/* 추가 조건 */}
        <div style={sectionStyle}>
          <div style={sectionTitle}>📌 추가 조건 확인</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <YesNoBtn field="taxDelinquent" label="국세·지방세 체납 여부" />
            <YesNoBtn field="hasBankruptcy" label="과거 폐업 이력" />
            <YesNoBtn field="exportRecord" label="최근 1년 수출 실적 1천달러 이상" />
            <YesNoBtn field="salesGrowth" label="2년 연속 매출 10% 이상 증가" />
            <div>
              <label style={labelStyle}>현재 사업자 수 (대표자 명의)</label>
              <div style={{ display: "flex", gap: 8 }}>
                {["1", "2+"].map((v) => (
                  <button key={v} onClick={() => set("currentBizCount", v)} style={{
                    flex: 1, padding: "9px",
                    border: `1.5px solid ${form.currentBizCount === v ? "#0f3460" : "#e0e0e0"}`,
                    borderRadius: 8, background: form.currentBizCount === v ? "#0f3460" : "white",
                    color: form.currentBizCount === v ? "white" : "#666",
                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                  }}>
                    {v === "1" ? "1개" : "2개 이상"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 스마트기기 */}
        <div style={sectionStyle}>
          <div style={sectionTitle}>🔧 스마트기기 보유 현황 (해당하는 것 모두 선택)</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {SMART_DEVICES.map((d) => (
              <button key={d} onClick={() => toggleDevice(d)} style={{
                padding: "7px 14px",
                border: `1.5px solid ${form.smartDevices.includes(d) ? "#0f3460" : "#e0e0e0"}`,
                borderRadius: 20, background: form.smartDevices.includes(d) ? "#0f3460" : "white",
                color: form.smartDevices.includes(d) ? "white" : "#555",
                fontSize: 13, cursor: "pointer", fontWeight: form.smartDevices.includes(d) ? 600 : 400,
              }}>
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* 분석 버튼 */}
        <button onClick={analyze} disabled={loading || !form.industry} style={{
          width: "100%", padding: 16,
          background: loading || !form.industry ? "#ccc" : "#0f3460",
          color: "white", border: "none", borderRadius: 12,
          fontSize: 16, fontWeight: 700,
          cursor: loading || !form.industry ? "not-allowed" : "pointer",
          marginBottom: 24,
        }}>
          {loading ? "분석 중..." : "🔍 정책자금 분석하기"}
        </button>

        {/* 결과 */}
        {result && (
          <div>
            {result.warnings.length > 0 && (
              <div style={{ background: "#fff3e0", border: "1.5px solid #ffb74d", borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
                {result.warnings.map((w, i) => <p key={i} style={{ margin: i > 0 ? "8px 0 0" : 0, fontSize: 14, color: "#e65100" }}>{w}</p>)}
              </div>
            )}
            {result.checks.length > 0 && (
              <div style={{ background: "#f1f8e9", border: "1.5px solid #aed581", borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
                {result.checks.map((c, i) => <p key={i} style={{ margin: i > 0 ? "8px 0 0" : 0, fontSize: 14, color: "#33691e" }}>{c}</p>)}
              </div>
            )}
            {result.bizAgeNum >= 7 && (
              <div style={{ background: "#e3f2fd", border: "1.5px solid #90caf9", borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
                <p style={{ margin: 0, fontSize: 14, color: "#0d47a1", fontWeight: 600 }}>📊 매출초과차입금 계산</p>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "#1565c0" }}>사업자대출 합계: {result.totalBizLoan.toLocaleString()}만원 | 잔여 가능: {result.remainingCapacity.toLocaleString()}만원</p>
                {result.totalPersonalLoan > 0 && <p style={{ margin: "4px 0 0", fontSize: 12, color: "#888" }}>개인신용대출 {result.totalPersonalLoan.toLocaleString()}만원은 계산 제외</p>}
              </div>
            )}
            {result.results.length > 0 ? (
              <>
                <p style={{ fontSize: 15, fontWeight: 700, color: "#0f3460", marginBottom: 12 }}>🎯 신청 가능한 자금 ({result.results.length}개)</p>
                {result.results.map((r, i) => (
                  <div key={i} style={{ background: "white", borderRadius: 12, padding: "18px 20px", marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", borderLeft: `4px solid ${r.color}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div>
                        <span style={{ fontSize: 11, background: "#f0f4ff", color: r.color, padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>{r.tag}</span>
                        <p style={{ margin: "6px 0 0", fontSize: 16, fontWeight: 700, color: "#1a1a2e" }}>{r.name}</p>
                      </div>
                      <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: r.color }}>{r.limit}</p>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                      <div style={{ background: "#f8f9fa", borderRadius: 6, padding: "8px 10px" }}>
                        <p style={{ margin: 0, fontSize: 11, color: "#888" }}>금리</p>
                        <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 600, color: "#444" }}>{r.rate}</p>
                      </div>
                      <div style={{ background: "#f8f9fa", borderRadius: 6, padding: "8px 10px" }}>
                        <p style={{ margin: 0, fontSize: 11, color: "#888" }}>상환기간</p>
                        <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 600, color: "#444" }}>{r.period}</p>
                      </div>
                    </div>
                    <p style={{ margin: "10px 0 0", fontSize: 12, color: "#666", background: "#f0f4ff", padding: "6px 10px", borderRadius: 6 }}>✅ {r.condition}</p>
                  </div>
                ))}
              </>
            ) : (
              <div style={{ background: "white", borderRadius: 12, padding: 24, textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                <p style={{ fontSize: 15, color: "#666" }}>입력하신 정보로는 해당되는 자금이 없습니다.</p>
                <p style={{ fontSize: 13, color: "#999", marginTop: 8 }}>리포인트파트너스에 문의하시면 추가 방법을 안내해드립니다.</p>
              </div>
            )}

            {/* AI 심층 분석 버튼 */}
            {onAIAnalysis && (
              <button onClick={() => onAIAnalysis(result.customerSummary)} style={{
                width: "100%", padding: 16, marginTop: 8,
                background: "linear-gradient(135deg, #1a237e, #0f3460)",
                color: "white", border: "none", borderRadius: 12,
                fontSize: 16, fontWeight: 700, cursor: "pointer",
                boxShadow: "0 4px 16px rgba(15,52,96,0.3)",
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
