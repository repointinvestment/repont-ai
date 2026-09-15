// lib/materialFormat.js
// 안내자료 텍스트 블록의 가벼운 서식 — **굵게**, ==강조색== 두 가지 문법만 지원.
// React 엘리먼트를 직접 만들어서 반환하기 때문에(dangerouslySetInnerHTML 안 씀) XSS 걱정 없이
// 안전하게 렌더링됨. 고객도 보는 공개 페이지라 이 점이 중요함.

import { createElement, Fragment } from 'react'

const ACCENT = '#B9862F' // 브랜드 골드 — 강조색 하나로 통일(색상 여러 개 고르게 하면 복잡해져서 일단 하나로)

export function renderFormattedText(text) {
  if (!text) return null
  // **굵게** 와 ==강조== 를 동시에 처리 — 토큰 단위로 쪼갠 뒤 순서대로 렌더링
  const tokens = text.split(/(\*\*[^*]+\*\*|==[^=]+==)/g)
  return tokens.map((token, i) => {
    if (token.startsWith('**') && token.endsWith('**')) {
      return createElement('strong', { key: i }, token.slice(2, -2))
    }
    if (token.startsWith('==') && token.endsWith('==')) {
      return createElement('span', { key: i, style: { color: ACCENT, fontWeight: 700 } }, token.slice(2, -2))
    }
    return createElement(Fragment, { key: i }, token)
  })
}
