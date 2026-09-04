// app/api/business-plan/route.js
// 소진공 공식 신청 서식(붙임2 기업현황 및 사업계획서)의 실제 항목 구조를 그대로 따라
// 사업계획서 초안을 생성. CRM에 있는 정보는 채우고, 없는 항목은 빈칸(________)으로 남겨둡니다.
// 파일이 아닌 화면 텍스트로 반환 (웹폼 제출/복사 붙여넣기 용도).
import OpenAI from 'openai'
import { sql } from '@/lib/db'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// 자금별로 "사업내용/사업개요" 문단에 반드시 녹여야 할 강조 포인트.
// 새 자금이 추가되면 이 목록에 항목만 추가하면 됩니다.
const FUND_GUIDANCE = {
  '신용취약소상공인자금': '신청 사업자의 신용점수가 낮아(대략 595~839점 구간) 일반 시중은행권에서 정상적인 신용대출이 어려운 상황임을 자연스럽게 서술하고, 이 자금을 통해 경영 안정과 재기의 발판을 마련하고자 하는 취지를 강조하세요.',
  '혁신성장촉진자금 일반형': '보유 중인 스마트기기·디지털 전환 요소(예: 테이블오더, 키오스크, 무인판매기 등)가 실제로 어떻게 운영 효율화와 매출 증대로 이어지는지 구체적으로 서술하세요. 어떤 기기를 어떻게 활용 중인지 고객 정보를 참고해 구체적으로 쓰세요.',
  '혁신성장촉진자금 혁신형': '수출 실적 또는 최근 2년 연속 매출 성장세를 구체적 수치로 제시하며, 그 성장 흐름을 이어갈 사업 잠재력을 강조하세요.',
  '재도전특별자금 일반형': '과거 폐업 이력과 그로부터 얻은 교훈, 현재 사업에 대한 재도전 의지를 진정성 있게 서술하고, 현재 사업자가 1개이며 업력 7년 미만이라는 요건 충족을 자연스럽게 녹이세요.',
  '신용보증재단': '이 자금은 재단 보증서를 받아 은행에서 대출을 실행하는 방식이므로, 상환 능력과 사업 안정성, 매출 흐름을 특히 강조해서 서술하세요.',
  '신용보증기금 (신보)': '이 자금은 신보 보증서를 받아 은행에서 대출을 실행하는 방식이므로, 상환 능력과 사업 안정성, 매출 규모·성장성을 특히 강조해서 서술하세요.',
  '기술보증기금 (기보)': '보유 특허나 대표자의 업력·기술력이 사업의 경쟁력과 어떻게 연결되는지 강조하고, 기보 보증서 기반 은행대출이므로 상환 능력과 사업 안정성도 함께 서술하세요.',
}

// fundName -> 어떤 공식 서식을 따를지 결정 (재도전특별자금과 혁신성장촉진자금은 소진공 서식1을 공유)
function resolveTemplate(fundName) {
  if (fundName === '신용취약소상공인자금') return 'SOJINKONG_SHORT'
  if (fundName.startsWith('재도전특별자금') || fundName.startsWith('혁신성장촉진자금')) return 'SOJINKONG_LONG'
  return 'GENERIC'
}

function field(label, value, width = 18) {
  const v = value !== null && value !== undefined && value !== '' ? String(value) : '________'
  return `${label.padEnd(width, ' ')}: ${v}`
}

function won(manwon) {
  if (!manwon) return null
  return `${(Number(manwon) * 10000).toLocaleString()}원`
}

// 필수자금집행계획(대출신청 금액과 합계가 같아야 하는 항목)은 지금까지 통째로 빈칸이었음 — 대출 신청 금액만 알면
// 정책자금 실무에서 흔히 쓰는 비율(인건비>원부자재>판로홍보>생산판매>기타)로 배분해서 초안을 채움.
// GPT가 아니라 코드로 계산해서 합계가 항상 정확히 맞도록 함(GPT 산술 오류·환각 위험 제거). 컨설턴트가 실제 집행계획에 맞춰 숫자만 바꾸면 됨.
function budgetBreakdown(loanAmountManwon) {
  if (!loanAmountManwon) return null
  const total = Math.round(Number(loanAmountManwon))
  const ratios = [
    ['인건비', 0.30],
    ['원부자재 구입비', 0.25],
    ['판로확보·홍보 등', 0.20],
    ['생산·판매 및 부대비용', 0.15],
    ['기타', 0.10],
  ]
  const amounts = ratios.map(([label, r]) => [label, Math.round(total * r)])
  const sum = amounts.reduce((s, [, v]) => s + v, 0)
  amounts[0][1] += total - sum // 반올림 오차는 가장 큰 항목(인건비)에서 흡수해 합계를 정확히 맞춤
  return amounts
}

function certLines({ hasPatent, hasYellowUmbrella, hasRndCenter, hasVentureCert }) {
  const items = []
  if (hasPatent) items.push('특허 보유')
  if (hasRndCenter) items.push('기업부설연구소 보유')
  if (hasVentureCert) items.push('벤처기업 인증')
  if (hasYellowUmbrella) items.push('노란우산공제 가입')
  return items.length > 0 ? items.join(', ') : null
}

async function generateParagraph({ fundName, customer, guidance, minChars, maxChars, instruction }) {
  const customerSummary = `
- 대표자명: ${customer.ownerName || '미입력'}
- 업체명: ${customer.businessName || '미입력'}
- 업종: ${customer.industry || '미입력'}
- 업력: ${customer.bizAge ? `${customer.bizAge}년` : '미입력'}
- 사업 내용: ${customer.businessContent || '미입력'}
- 최근 매출: ${customer.revenue ? `${Number(customer.revenue).toLocaleString()}만원` : '미입력'}
- 신용점수: NICE ${customer.creditNice || '-'} / KCB ${customer.creditKcb || '-'}
- 직원 수: ${customer.employeeCount ?? '미입력'}명
- 보유 스마트기기: ${customer.smartDevices && customer.smartDevices.length > 0 ? customer.smartDevices.join(', ') : '없음'}
- 대표자 관련업종 경력: ${customer.careerYears ? `약 ${customer.careerYears}년` : '미입력'}
- 인증·특허 현황: ${certLines(customer) || '없음'}
- 신청 대출 금액: ${customer.loanAmount ? `${Number(customer.loanAmount).toLocaleString()}만원` : '미입력'}
`.trim()

  const systemPrompt = `당신은 정책자금 신청용 사업계획서를 작성하는 전문 컨설턴트입니다.
아래 고객 정보와 자금별 강조 포인트를 반영해 "${fundName}" 신청서의 사업내용 문단만 작성하세요.
- 정중하고 formal한 사업계획서체(자연스러운 서술문)로 작성
- 제공된 정보 범위 내에서만 작성하고 확인되지 않은 사실을 지어내지 마세요
- 대표자 경력·인증·특허 등 강점 정보가 있으면 "~한 경력을 바탕으로", "~을 보유하고 있어 기술 경쟁력이 있으며" 같은 방식으로 사업 경쟁력을 뒷받침하는 근거로 문장에 자연스럽게 녹여내세요. "특허 보유: 있음"처럼 사실을 나열식으로 쓰지 마세요.
- ${instruction}
- 분량은 ${minChars}자 ~ ${maxChars}자 사이 (띄어쓰기 포함)
- 문단 텍스트만 출력하고, 제목이나 안내문은 붙이지 마세요`

  const userMessage = `${customerSummary}\n\n[강조할 점]\n${guidance}`

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    max_tokens: 1200,
  })
  return response.choices[0].message.content.trim()
}

export async function POST(req) {
  const { customer, fundName, customerId } = await req.json()
  const guidance = FUND_GUIDANCE[fundName] || '이 자금의 세부 요건에 맞춰 사업의 강점을 자연스럽게 강조하세요.'
  const template = resolveTemplate(fundName)
  const createdBy = req.headers.get('x-consultant-id') || null

  async function saveAndRespond(draft) {
    if (customerId) {
      try {
        await sql`
          INSERT INTO business_plans (customer_id, fund_name, content, created_by)
          VALUES (${customerId}, ${fundName}, ${draft}, ${createdBy})
        `
      } catch (err) {
        console.error('사업계획서 저장 실패:', err)
      }
    }
    return Response.json({ draft })
  }

  if (template === 'SOJINKONG_SHORT') {
    const paragraph = await generateParagraph({
      fundName, customer, guidance, minChars: 300, maxChars: 1000,
      instruction: '주 서비스·생산품목의 용도 및 특성(서비스 및 상품의 주요 내용, 제품의 다양성, 인지도 등)을 중심으로 작성',
    })
    const annualRevenueWon = customer.revenue ? `${(Number(customer.revenue) * 10000).toLocaleString()}원` : null
    const ownershipMap = { '자가': '유', '임대': '유', '가족소유': '유' } // 온라인 서식은 자가/임차 구분 없이 "점포 보유현황: 유/무"만 물음
    const storefront = customer.addressOwnership ? (ownershipMap[customer.addressOwnership] || '유') : null
    const budget = budgetBreakdown(customer.loanAmount)

    const draft = `<신용취약소상공인자금 기업현황 및 사업계획서>
(소진공 온라인 신청 화면 ols.semas.or.kr 실제 항목·순서 그대로 — 그대로 복사해 각 칸에 붙여넣거나, 다운로드해서 쓰세요. CRM에 없는 항목은 빈칸(________)입니다.)

1. 영업현황 및 사업개요

[영업현황]
${field('주 서비스·생산품목 *', customer.industry)}
${field('매출액 * (원)', annualRevenueWon)}
${field('주 사용 플랫폼', null)} (예: 쿠팡, 네이버쇼핑 등 — 해당 없으면 공란)
${field('점포 보유현황 *', storefront)} (유 / 무 중 선택)

[사업개요 *] — 주서비스·생산품목의 용도 및 특성 (최대 1,000자)
${paragraph}

2. 대표자 및 실제경영자 경력

[공동대표자] * — 표: 성명 | 기간(년월~년월) | 근무처 | 담당업무 | 최종직위
1행: ${customer.ownerName || '________'} | ________~________ | ________ | ________ | ________
(공동대표자가 더 있으면 "+ 추가"로 행을 늘려 같은 형식으로 입력)

[실제경영자] — 대표자 본인이 아닌 실제경영자가 있는 경우만 작성 (표: 성명 | 기간 | 근무처 | 담당업무 | 최종직위 | 대표자와의 관계)
해당 없으면 공란으로 제출

[경영진] — 대표자·실제경영자 제외 (표: 성명 | 연령 | 최종직위 | 대표자·실제경영자와의 관계 | 주요경력 | 근무년수)
해당 없으면 공란으로 제출

3. 자금집행계획 (1개 이상 필수 입력 — 합계는 대출신청 금액과 반드시 동일해야 함)${customer.loanAmount ? ` — 대출신청 금액 ${(Number(customer.loanAmount) * 10000).toLocaleString()}원 기준 통상 배분 비율로 초안 작성. 실제 집행계획에 맞춰 용도·세부용도·금액을 수정하세요.` : ' — 신청 금액을 입력하지 않아 배분 초안을 만들지 못했습니다. 다시 작성하며 신청 금액을 입력해주세요.'}
표: 용도(대분류) | 세부용도(30자 이내) | 금액(원)
${budget ? budget.map(([label, amt]) => `${label} | ________ | ${(amt * 10000).toLocaleString()}원`).join('\n') : '________ | ________ | ________'}
${budget ? `합계: ${(Number(customer.loanAmount) * 10000).toLocaleString()}원` : ''}

※ 온라인 신청 화면 하단 "유의사항" 동의 체크박스는 컨설턴트/고객이 직접 내용을 읽고 체크해야 합니다(자동 대체 불가).
※ 이 초안은 참고용이며, 실제 제출 전 소상공인시장진흥공단 최신 공고문의 서식과 요건을 다시 확인해주세요.`

    return saveAndRespond(draft)
  }

  if (template === 'SOJINKONG_LONG') {
    const paragraph = await generateParagraph({
      fundName, customer, guidance, minChars: 100, maxChars: 3000,
      instruction: '자금 신청 주요 내용과 대출금 사용목적, 활용계획을 중심으로 작성',
    })
    const ownershipMap = { '자가': '자가', '임대': '임차', '가족소유': '자가(가족소유)' }
    const ownership = ownershipMap[customer.addressOwnership] || null
    const monthlyRevenue = customer.revenue ? won(Math.round(Number(customer.revenue) / 12)) : null
    const quarterlyRevenue = customer.revenue ? won(Math.round(Number(customer.revenue) / 4)) : null
    const isJaedojeon = fundName.startsWith('재도전특별자금')
    const budget = budgetBreakdown(customer.loanAmount)

    const draft = `<${fundName.startsWith('재도전') ? '재도전특별자금' : '혁신성장촉진자금'} 기업현황 및 사업계획서>
(소진공 공식 서식 기준 — CRM에 없는 항목은 빈칸으로 표시했습니다. 직접 채워 넣어주세요.)

선택1. 회사연혁
${field('연혁', null, 10)}

필수2. 대표자(대표이사) 및 실제경영자
${field('성명', customer.ownerName)}
${field('최종학력(학위)', null)}
${field('전공', null)}
${field('동업종 종사기간', customer.careerYears ? `약 ${customer.careerYears}년` : (customer.bizAge ? `약 ${customer.bizAge}년` : null))}

선택3. 경영진 (대표자·실제경영자 제외)
${field('명단', null, 10)}

선택4. 조직도 및 업무분장표
${field('구성', null, 10)}

필수5. 사업장 현황
${field('소유구분', ownership)}

필수6. 생산 및 판매 현황
${field('판매방식', null)}
${field('생산방식', null)}
${field('가동상황', null)}

필수7. 매출 현황${customer.revenue ? ' — 분기별 실적 데이터가 없어 연매출을 4등분한 추정치입니다. 실제 분기 실적으로 바꿔주세요.' : ''}
${field('현재 매출액(월)', monthlyRevenue)}
${field('1분기', quarterlyRevenue)}
${field('2분기', quarterlyRevenue)}
${field('3분기', quarterlyRevenue)}
${field('4분기', quarterlyRevenue)}

선택8. 주요거래처
${field('거래처 정보', null, 10)}

선택9. 지식재산권 및 인증현황, 수상실적
${field('지식재산권', customer.hasPatent ? '☑ 특허증' : null)}
${field('인증·수상', null)}

필수10. 사업계획서
◦ 필수사업내용 (100자~3,000자)
${paragraph}

◦ 필수자금집행계획${customer.loanAmount ? ` — 대출신청 금액 ${Number(customer.loanAmount).toLocaleString()}만원 기준 통상 배분 비율로 초안 작성. 실제 집행계획에 맞춰 수정하세요.` : ''}
${budget ? budget.map(([label, amt]) => field(label, `${amt.toLocaleString()}만원`)).join('\n') : [
  field('원부자재 구입비', null),
  field('생산·판매 및 부대비용', null),
  field('판로확보·홍보 등', null),
  field('인건비', null),
  field('기타', null),
].join('\n')}
${isJaedojeon ? `
선택11. 과거 폐업 기업 현황 (재창업 초기단계·도약형 신청 시)
${field('업체명', null)}
${field('폐업일자', null)}
${field('폐업사유', null)}` : ''}

※ 이 초안은 참고용이며, 실제 제출 전 소상공인시장진흥공단 최신 공고문의 서식과 요건을 다시 확인해주세요.`

    return saveAndRespond(draft)
  }

  // GENERIC: 아직 공식 서식이 등록되지 않은 기관(재단/신보/기보 등) — 일반 사업계획서 형식으로 작성
  const systemPrompt = `당신은 정책자금 신청용 사업계획서 초안을 작성하는 전문 컨설턴트입니다.
아래 제공되는 고객 정보와 신청하려는 자금의 특성을 바탕으로, 실제 제출 가능한 수준의 사업계획서 초안을 작성하세요.

[사업계획서 구성 - 이 순서와 소제목을 그대로 사용]
1. 사업 개요
2. 대표자 및 기업 현황
3. 신청 자금 개요 및 신청 사유
4. 자금 사용 계획
5. 향후 사업 계획 및 기대 효과

[작성 원칙]
- 정중하고 formal한 사업계획서체로 작성 (완전한 문장, "~함", "~임" 개조식이 아닌 자연스러운 서술문)
- 제공된 고객 정보 범위 내에서만 작성하고, 확인되지 않은 사실을 지어내지 마세요
- 구체적인 숫자(매출액, 신용점수 등)가 있으면 반드시 인용해 신뢰도를 높이세요
- 대표자 경력·인증·특허 등 강점 정보가 있으면 "2. 대표자 및 기업 현황"에서 "~한 경력을 바탕으로", "~을 보유하고 있어 경쟁력이 있으며" 같은 방식으로 자연스럽게 녹여내세요. "벤처인증: 있음"처럼 사실을 나열식으로 쓰지 마세요.
- "3. 신청 자금 개요 및 신청 사유" 항목에는 아래 안내된 이 자금 특유의 강조 포인트를 반드시 자연스럽게 녹여내세요
- 마지막에 "※ 이 초안은 참고용이며, 이 기관은 아직 공식 서식이 등록되지 않아 일반 형식으로 작성되었습니다. 실제 제출 전 해당 기관의 최신 공고문 요건과 서식을 다시 확인해주세요."라는 안내 문구를 반드시 추가하세요`

  const customerSummary = `
- 대표자명: ${customer.ownerName || '미입력'}
- 업체명: ${customer.businessName || '미입력'}
- 업종: ${customer.industry || '미입력'}
- 업력: ${customer.bizAge ? `${customer.bizAge}년` : '미입력'}
- 사업 내용: ${customer.businessContent || '미입력'}
- 최근 매출: ${customer.revenue ? `${Number(customer.revenue).toLocaleString()}만원` : '미입력'}
- 신용점수: NICE ${customer.creditNice || '-'} / KCB ${customer.creditKcb || '-'}
- 직원 수: ${customer.employeeCount ?? '미입력'}명
- 보유 스마트기기: ${customer.smartDevices && customer.smartDevices.length > 0 ? customer.smartDevices.join(', ') : '없음'}
- 대표자 관련업종 경력: ${customer.careerYears ? `약 ${customer.careerYears}년` : '미입력'}
- 인증·특허 현황: ${certLines(customer) || '없음'}
- 사업장 소유구분: ${customer.addressOwnership || '미입력'}
- 신청 대출 금액: ${customer.loanAmount ? `${Number(customer.loanAmount).toLocaleString()}만원` : '미입력'}
- 신청 자금: ${fundName}
`.trim()

  const budgetForGeneric = budgetBreakdown(customer.loanAmount)
  const budgetHint = budgetForGeneric
    ? `\n\n[참고용 자금사용계획 배분(통상 비율, 신청금액 ${Number(customer.loanAmount).toLocaleString()}만원 기준) — "4. 자금 사용 계획"에 이 배분을 반영해 서술하세요]\n${budgetForGeneric.map(([label, amt]) => `- ${label}: ${amt.toLocaleString()}만원`).join('\n')}`
    : ''

  const userMessage = `아래 고객 정보로 "${fundName}" 신청용 사업계획서 초안을 작성해주세요.\n\n${customerSummary}\n\n[이 자금 작성 시 강조할 점]\n${guidance}${budgetHint}`

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    max_tokens: 2000,
  })

  return saveAndRespond(response.choices[0].message.content)
}
