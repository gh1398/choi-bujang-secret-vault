# BYTE BACK 방어전 시작 틀 R5 · 5단계

이 저장소는 BYTE BACK 방어전 5단계의 학습용 자료실입니다. 자료 네 건은 모두 가상 메모이며 실제 학생 자료, 토큰, 비밀키를 저장하지 마세요.

## 현재 동작

- `/` 화면은 `/api/auth/login`, `/api/auth/session`, `/api/auth/logout` 서버 함수를 통해 이메일 로그인·세션 확인·로그아웃을 처리하고, `/api/notes`와 `/api/notes/:id`로 가상 메모를 관리합니다. Supabase 공개 키와 세션 토큰은 화면 코드에서 사용하지 않습니다. 서버는 access/refresh 토큰을 HttpOnly 쿠키로 관리합니다.
- `api/notes.js`의 목록은 검증된 사용자 ID의 메모만 반환하고, 추가할 때 서버가 확인한 ID를 `owner_id`로 저장합니다. 단건 GET·PUT·DELETE도 DB의 `owner_id`를 검증된 사용자 ID와 비교하며, 타인 소유 또는 없는 메모는 404로 거부합니다. PUT은 저장할 `owner_id`도 검증된 사용자 ID로 설정하고 반환된 소유자를 확인합니다.
- 자료 API는 `src/verify-login.mjs`가 Supabase Auth 발급자·대상·만료를 검증한 세션만 허용하고, 브라우저의 `userId`·`role`과 URL·본문의 `owner_id`는 신뢰하지 않습니다. 토큰이 없거나 검증에 실패하면 401로 자료 없이 거부합니다. DB 권한/RLS SQL은 별도 검토·적용 대상입니다.
- 로그인 서버 함수는 Vercel 환경 변수 `SUPABASE_URL`과 서버 전용 `SUPABASE_SECRET_KEY`를 사용합니다. 세션 토큰은 HttpOnly 쿠키로만 전달되며, 비밀번호·키·토큰을 브라우저 코드, JSON 응답, 로그 또는 Git에 넣지 않습니다. 로그인 실패 이유는 화면에 표시합니다.
- `aleph.config.json`의 `originalApiUrl`은 원본 자료 HTTPS 경로이며 쿼리가 없습니다. Vercel 배포 빌드는 이 값을 `/aleph.json`에도 기록합니다.
- Vercel 빌드는 공개 `data.json`을 만들지 않습니다. 배포 빌드는 Vercel Git/배포 정보를 검증해 `/aleph.json`을 계속 생성합니다.

## 설정 및 실행

Supabase Auth에서 이메일·비밀번호 로그인을 사용할 수 있게 설정하고, `learning_notes` 테이블을 준비합니다. 테이블은 RLS가 켜져 있어야 하며 브라우저 역할에 읽기 권한을 주지 않습니다. `owner_id`는 UUID 열이며 `auth.users` 외래키를 사용하지 않습니다. 서버 함수는 Vercel의 `SUPABASE_SECRET_KEY`로 발급자 정보를 검증하고 자료를 읽습니다.

Vercel 프로젝트 설정의 Environment Variables에 `SUPABASE_URL`과 `SUPABASE_SECRET_KEY`를 등록한 뒤 `main`에 푸시해 배포합니다. 정상 동작은 로그인 전 자료 요청이 거부되고, 정상 이메일·비밀번호 로그인 후 내 메모 목록이 표시되며 추가·수정·삭제가 동작하고 `/aleph.json`에 현재 저장소·커밋·배포 주소와 `originalApiUrl`이 나오는 것입니다. 다른 계정 소유 메모의 단건 GET·PUT·DELETE는 404여야 합니다. 로그인 실패 이유는 화면에 표시합니다. API에는 유효한 로그인 토큰이 없거나 검증에 실패하면 401과 자료 없는 응답을 반환합니다.

로컬 정적 미리보기는 `npm run build -- --local`로 준비할 수 있습니다. 이 명령은 `/aleph.json`을 만들지 않으며 Vercel 배포나 Supabase 연결을 증명하지 않습니다. 로컬 API 실행은 Vercel 개발 환경을 사용하세요.

## 가상 메모 문장 노출 확인

아래 네 문장은 학습용 가상 자료의 확인 문자열입니다.

- `실습용 가상 과제 기록`
- `실습용 가상 포트폴리오 기록`
- `실습용 가상 리추얼 기록`
- `실습용 가상 행정 기록`

### 현재 Vercel 배포

Vercel 프로젝트의 **Deployments**에서 현재 Production 배포를 열고 **Visit** 주소를 확인합니다. 아래 PowerShell 명령에서 주소만 실제 Production 도메인으로 바꿔 현재 응답을 검사합니다. 이 명령은 응답 본문을 출력하지 않고 상태 코드와 문장 일치 개수만 표시합니다.

```powershell
$base = 'https://<production-domain>'
$phrases = @('실습용 가상 과제 기록', '실습용 가상 포트폴리오 기록', '실습용 가상 리추얼 기록', '실습용 가상 행정 기록')
foreach ($route in @('/', '/data.json', '/aleph.json', '/api/notes')) {
  $response = Invoke-WebRequest -Uri ($base + $route) -SkipHttpErrorCheck
  $matches = @($phrases | Where-Object { $response.Content.Contains($_) })
  '{0} status={1} matches={2}' -f $route, $response.StatusCode, $matches.Count
}
```

비로그인 확인에서는 정적 `/`와 `/aleph.json`에서 네 문장이 검색되지 않고, `/data.json`은 404, `/api/notes`는 자료 없이 401을 반환해야 합니다. 정상 로그인 후 API 목록에는 해당 사용자 소유의 메모 배열이 표시되어야 합니다. 실제 자료가 API 응답에 섞이면 안 됩니다.

### GitHub `main` 최신 파일

저장소 루트에서 원격 `main`의 최신 커밋을 가져온 뒤, 배포 자료와 API의 고정 가상 문장을 검색합니다.

```sh
git fetch origin main
git grep -n -F -e '실습용 가상 과제 기록' -e '실습용 가상 포트폴리오 기록' -e '실습용 가상 리추얼 기록' -e '실습용 가상 행정 기록' FETCH_HEAD -- data.json api/notes.js public
```

현재 API는 메모 본문을 코드에 고정하지 않으므로 검색 결과는 원본 학습 fixture `data.json`에만 나오는 것이 예상됩니다. `public/data.json`은 없어야 하며 `public/index.html`에도 메모 문장이 없어야 합니다. 검색 결과가 없을 때 `git grep`은 종료 코드 1을 반환합니다.

이 검사는 현재 Production 응답과 현재 GitHub `main`만 확인합니다. 공개된 옛 커밋이나 이전 Vercel 배포가 남아 있으면 과거 노출이 해소됐다고 쓰지 마세요. 과거 커밋은 `git log --all -S'<문장>' --oneline -- data.json public/data.json`으로, 이전 배포는 Vercel의 **Deployments** 목록에서 각각 확인하고 접근 가능 상태인지 별도로 점검합니다.

## 다음 단계의 코딩 도구에 전달할 규칙

[AGENTS.md](AGENTS.md)를 먼저 읽히고 한 번에 한 제작 단위만 요청하세요. 4단계 API 소유자 검사는 유지되며, 5단계 원본 자료 API 주소는 `aleph.config.json`에 기록되어 있습니다. 이후 단계의 추가 허용 경로·원본 API 주소·정책 규칙은 해당 단계 원고와 계약에 맞춰 추가합니다. 비밀번호·토큰·서버 전용 키·실제 학생 기록을 코드, Git, 제출 묶음에 넣지 않습니다.

`src/decider.mjs`와 `src/detect.mjs`의 로컬 시험은 반 엔진이나 운영 심판의 결과가 아닙니다. 제출 묶음 계약 `aleph.defense.submission.v2`는 `scripts/bundle.mjs`에 남아 있으며, 코딩 도구가 해당 단계의 최신 배포 주소와 Git 원격을 맞춘 뒤 사용합니다.
