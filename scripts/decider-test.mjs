import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixtureRequests } from './fixture-7.mjs';

const RESPONSE_KEYS = 'decision,reasonCode,requestId,ruleIds,schema';

function validResponse(request, response, ruleIds) {
  return response && typeof response === 'object' && !Array.isArray(response)
    && Object.keys(response).sort().join(',') === RESPONSE_KEYS
    && response.schema === 'aleph.decision.v1'
    && response.requestId === request.requestId
    && ['allow', 'deny', 'step_up'].includes(response.decision)
    && typeof response.reasonCode === 'string'
    && /^[a-z][a-z0-9_]{0,63}$/u.test(response.reasonCode)
    && Array.isArray(response.ruleIds) && response.ruleIds.length > 0
    && response.ruleIds.every(id => ruleIds.includes(id));
}

// Local practice only. The class engine and the server judge validate live requests separately.
export async function checkDecider({ decide, ruleIds }) {
  if (typeof decide !== 'function' || !Array.isArray(ruleIds)
      || !ruleIds.includes('device_registered')) {
    throw new Error('6단계 device_registered 규칙을 먼저 구현하고 RULE_IDS에 적어 주세요.');
  }
  const { normal, suspicious } = fixtureRequests();
  const checks = [
    { name: '등록 기기의 정상 요청', request: normal, decision: 'allow' },
    { name: '엔진 출처 정상 신호', request: { ...normal, requestId: randomUUID(),
      signals: { source: 'engine', region: 'local', network: 'usual', hour: 14 } }, decision: 'allow' },
    { name: '엔진 출처 복합 이상 신호', request: { ...suspicious, requestId: randomUUID(),
      signals: { ...suspicious.signals, source: 'engine' } }, decision: 'step_up',
    reasonCode: 'step_up_required' },
    { name: '명시적 엔진 출처 라벨 복합 이상 신호', request: { ...suspicious,
      requestId: randomUUID(), signals: { ...suspicious.signals, source: 'verified_context' } },
    decision: 'step_up', reasonCode: 'step_up_required' },
    { name: '동일 의미의 새 네트워크·대량 읽기 라벨', request: { ...suspicious,
      requestId: randomUUID(), signals: { ...suspicious.signals, source: 'verified_context',
        network: 'new network', hour: '03' },
      recentEvents: [{ kind: 'bulk_read', ageSeconds: 60, count: 20 }] },
    decision: 'step_up', reasonCode: 'step_up_required' },
    { name: '세 조건 중 시각이 정상인 조합은 허용', request: { ...suspicious,
      requestId: randomUUID(), signals: { ...suspicious.signals, source: 'verified_context',
        hour: 14 } }, decision: 'allow' },
    { name: '출처 없는 신호는 추정하지 않음', request: { ...suspicious, requestId: randomUUID(),
      signals: { source: 'none', region: 'unknown', network: 'unknown', hour: null } }, decision: 'allow' },
    { name: '미등록 기기의 가상 요청', request: { ...normal, requestId: randomUUID(),
      deviceRegistered: false }, decision: 'deny', reasonCode: 'device_not_registered' },
  ];
  if (ruleIds.includes('step_up_required')) {
    checks.push(
      { name: '복합 이상 접속', request: suspicious, decision: 'step_up',
        reasonCode: 'step_up_required' },
      { name: '다시 확인한 복합 이상 접속', request: { ...suspicious,
        requestId: randomUUID(), stepUp: { verified: true, authAgeSeconds: 60 } },
      decision: 'allow' },
    );
  }
  const results = [];
  for (const item of checks) {
    const response = await decide(item.request);
    const valid = validResponse(item.request, response, ruleIds)
      && response.decision === item.decision
      && (!item.reasonCode || response.reasonCode === item.reasonCode);
    results.push({ name: item.name, passed: valid });
  }
  return results;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { decide, RULE_IDS } = await import('../src/decider.mjs');
    const results = await checkDecider({ decide, ruleIds: RULE_IDS });
    for (const item of results) process.stdout.write(`${item.passed ? '통과' : '확인 필요'} · ${item.name}\n`);
    process.stdout.write('이 명령은 가상 요청으로 연습하며 심판 통과 증거가 아닙니다.\n');
    if (results.some(item => !item.passed)) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`판정기 연습 첫 오류: ${error.message}\n`);
    process.exitCode = 1;
  }
}
