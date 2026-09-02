// lib/policyFundsLookup.js
// 정책자금 마스터 DB(funds/rules 배열)를 key로 바로 찾을 수 있게 인덱싱하는 공통 헬퍼.
// analyzePolicyFunds / estimateInstitutionLimits / chat 시스템 프롬프트 빌더가 모두 이 형태를 씀.

export function indexFunds(funds) {
  const byKey = {};
  for (const f of funds || []) byKey[f.key] = f;
  return byKey;
}

export function indexRules(rules) {
  const byKey = {};
  for (const r of rules || []) byKey[r.key] = r;
  return byKey;
}

// 클라이언트 컴포넌트에서 쓰는 fetch 래퍼. activeOnly=true면 비활성 자금(중진공 통상변화대응 등) 제외.
export async function fetchPolicyFundsData({ activeOnly = true } = {}) {
  const res = await fetch(`/api/policy-funds${activeOnly ? '?active=1' : ''}`);
  if (!res.ok) throw new Error('정책자금 마스터 DB를 불러오지 못했습니다.');
  const data = await res.json();
  return {
    funds: data.funds || [],
    rules: data.rules || [],
    fundsByKey: indexFunds(data.funds),
    rulesByKey: indexRules(data.rules),
  };
}
