// app/api/business-plan/route.js
// 고객 정보 + 신청하려는 정책자금의 특성을 바탕으로 사업계획서 초안을 생성.
// 소진공 등 다수 기관이 한글파일 업로드 대신 웹폼 제출로 전환 중이라, 파일이 아닌
// 화면에 바로 붙여넣을 수 있는 텍스트로 반환합니다.
import OpenAI from 'openai'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// 자금별로 사업계획서에 반드시 녹여야 할 강조 포인트.
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

const SYSTEM_PROMPT = `당신은 정책자금 신청용 사업계획서 초안을 작성하는 전문 컨설턴트입니다.
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
- "3. 신청 자금 개요 및 신청 사유" 항목에는 아래 안내된 이 자금 특유의 강조 포인트를 반드시 자연스럽게 녹여내세요
- 마지막에 "※ 이 초안은 참고용이며, 실제 제출 전 해당 기관의 최신 공고문 요건과 서식을 다시 확인해주세요."라는 안내 문구를 반드시 추가하세요`

export async function POST(req) {
  const { customer, fundName } = await req.json()

  const guidance = FUND_GUIDANCE[fundName] || '이 자금의 세부 요건에 맞춰 사업의 강점을 자연스럽게 강조하세요.'

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
- 특허보유: ${customer.hasPatent ? '있음' : '없음'}
- 신청 자금: ${fundName}
`.trim()

  const userMessage = `아래 고객 정보로 "${fundName}" 신청용 사업계획서 초안을 작성해주세요.\n\n${customerSummary}\n\n[이 자금 작성 시 강조할 점]\n${guidance}`

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    max_tokens: 2000,
  })

  return Response.json({ draft: response.choices[0].message.content })
}
