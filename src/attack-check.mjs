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
    observed = `비로그인 요청 응답 확인 (HTTP ${response.status})`;
    if (response.status === 401) {
      try {
        const data = await response.json();
        observed = data?.error === 'UNAUTHORIZED' && !Object.hasOwn(data, 'notes')
          ? '비로그인 요청이 HTTP 401로 거부되고 자료 필드가 없음'
          : '비로그인 401 응답 형식에 자료 필드가 포함됨';
      } catch {
        observed = '비로그인 요청이 HTTP 401로 거부됐지만 JSON 응답을 확인하지 못함';
      }
    } else if (response.ok) {
      try {
        const data = await response.json();
        const actual = Array.isArray(data) ? data : [];
        const matches = actual.length === SAMPLE_NOTES.length
          && SAMPLE_NOTES.every((sample, index) => actual[index]?.title === sample.title
            && actual[index]?.body === sample.content);
        observed = matches
          ? '비로그인 응답에서 자료 접근 가능성을 확인함'
          : '비로그인 요청이 거부되지 않고 JSON을 반환함';
      } catch {
        observed = '비로그인 요청이 거부되지 않고 JSON이 아닌 응답을 반환함';
      }
    }
  } catch {
    observed = '비로그인 자료 API 요청에 실패해 응답을 확인하지 못함';
  }

  return [{
    attackId: 'anonymous_notes_api',
    expected: '비로그인 요청은 HTTP 401로 거부되고 자료를 반환하지 않음',
    observed,
  }];
}
