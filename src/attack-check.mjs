const SAMPLE_NOTES = [
  { title: '과제', content: '실습용 가상 과제 기록' },
  { title: '포트폴리오', content: '실습용 가상 포트폴리오 기록' },
  { title: '아침 리추얼', content: '실습용 가상 리추얼 기록' },
  { title: '훈련 행정 자료', content: '실습용 가상 행정 기록' },
];

// Record response facts only. Never include note bodies, keys, or server errors.
export async function runAttackChecks(config) {
  if (!Number.isInteger(config.step) || config.step < 2 || config.step > 12) {
    throw new Error('2단계 이후 자료 API 점검을 확인해 주세요.');
  }
  let app;
  try {
    app = new URL(config.publicAppUrl);
  } catch {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }
  if (app.protocol !== 'https:' || app.username || app.password || app.search || app.hash
      || app.pathname !== '/' || app.hostname.endsWith('.example')) {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }
  if (typeof config.sampleMarker !== 'string' || !config.sampleMarker) {
    throw new Error('가상 메모의 확인 표시를 넣어 주세요.');
  }

  let observed;
  try {
    const response = await fetch(new URL('/api/notes', app), {
      method: 'GET', credentials: 'omit', cache: 'no-store', redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });
    observed = `비로그인 요청에서 자료 API를 확인하지 못함 (HTTP ${response.status})`;
    if (response.ok) {
      try {
        const data = await response.json();
        const actual = Array.isArray(data?.notes) ? data.notes : [];
        const matches = data?.sampleMarker === config.sampleMarker
          && actual.length === SAMPLE_NOTES.length
          && SAMPLE_NOTES.every((sample, index) => actual[index]?.title === sample.title
            && actual[index]?.content === sample.content);
        observed = matches
          ? '비로그인 응답에서 허용된 가상 메모 네 건만 확인'
          : '비로그인 응답이 네 가상 메모 허용 목록과 일치하지 않음';
      } catch {
        observed = '비로그인 자료 API가 JSON 응답을 반환하지 않음';
      }
    }
  } catch {
    observed = '비로그인 자료 API 요청에 실패해 응답을 확인하지 못함';
  }

  return [{
    attackId: 'anonymous_notes_api',
    expected: '공개 API는 네 가상 메모만 반환하며 비밀값은 노출하지 않음',
    observed,
  }];
}