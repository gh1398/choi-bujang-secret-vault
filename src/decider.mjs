// ALEPH SDP 엔진이 확인한 요청만 받는 학생 판정기 시작점입니다.
// 7단계: 등록 기기를 요구하고, 가상 접근 위험 신호에는 추가 확인을 요청합니다.
// 요청 본문의 userId, role, 기기 키, 토큰을 별도로 믿거나 저장하지 마세요.
export const RULE_IDS = Object.freeze(['device_registered', 'step_up_required']);

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// Access context is kept separate from policy decisions. Missing or untrusted values stay null.
export function inspectAccessContext(request) {
  const signals = isRecord(request) && isRecord(request.signals) ? request.signals : null;
  const declaredSource = typeof signals?.source === 'string' ? signals.source.trim() : '';
  const signalSource = !declaredSource ? 'unknown'
    : declaredSource.toLowerCase() === 'none' ? 'none' : declaredSource;
  // The request is engine-issued: accept explicit provenance labels, but never infer missing data.
  const hasTrustedSignals = signalSource !== 'none' && signalSource !== 'unknown';
  const region = signals?.region;
  const network = signals?.network;
  const hour = signals?.hour;
  const events = isRecord(request) && Array.isArray(request.recentEvents)
    && request.recentEvents.length <= 12
    && request.recentEvents.every(event => isRecord(event)
      && typeof event.kind === 'string' && Number.isFinite(event.ageSeconds)
      && Number.isFinite(event.count))
    ? request.recentEvents : null;
  const behavior = signalSource === 'unknown' ? null : events;

  return {
    signals: {
      source: signalSource,
      region: hasTrustedSignals && typeof region === 'string' && region.trim() ? region : null,
      hour: hasTrustedSignals && Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : null,
      network: hasTrustedSignals && typeof network === 'string' && network.trim() ? network : null,
    },
    behavior: {
      source: behavior === null ? 'unknown'
        : signalSource === 'judge_fixture' ? 'judge_fixture' : 'engine',
      events: behavior,
    },
  };
}

function needsStepUp(request) {
  const context = inspectAccessContext(request);
  if (context.signals.source === 'none' || context.signals.source === 'unknown') return false;

  const hour = context.signals.hour;
  const offHours = hour !== null && (hour < 6 || hour >= 22);
  const firstSeenNetwork = context.signals.network === 'first_seen';
  const suddenReadBurst = context.behavior.events?.some(event =>
    event.kind === 'read_burst' && event.ageSeconds <= 300 && event.count >= 20) === true;

  return offHours && firstSeenNetwork && suddenReadBurst;
}

export async function decide(request) {
  const registered = request.deviceRegistered === true;
  const riskDetected = needsStepUp(request);
  const stepUpVerified = request.stepUp?.verified === true
    && Number.isInteger(request.stepUp.authAgeSeconds)
    && request.stepUp.authAgeSeconds >= 0 && request.stepUp.authAgeSeconds <= 900;

  if (!registered) {
    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'deny',
      reasonCode: 'device_not_registered',
      ruleIds: ['device_registered'],
    };
  }

  if (riskDetected && !stepUpVerified) {
    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'step_up',
      reasonCode: 'step_up_required',
      ruleIds: ['device_registered', 'step_up_required'],
    };
  }

  return {
    schema: 'aleph.decision.v1',
    requestId: request.requestId,
    decision: 'allow',
    reasonCode: 'approved',
    ruleIds: riskDetected ? ['device_registered', 'step_up_required'] : ['device_registered'],
  };
}
