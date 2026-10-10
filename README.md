# BYTE BACK 방어전 시작 틀 R5 · 2단계

이 저장소는 BYTE BACK 방어전 2단계의 학습용 자료실입니다. 자료 네 건은 모두 가상 메모이며 실제 학생 자료, 토큰, 비밀키를 저장하지 마세요.

## 현재 동작

- `/` 화면은 `/api/notes`를 호출해 Supabase의 `learning_notes` 테이블에서 학습용 가상 메모를 표시합니다.
- `api/notes.js`는 `owner_id`가 비어 있고 내용이 시작 틀의 네 가상 메모와 정확히 일치하는 행만 반환합니다. 일반 사용자 메모는 반환하지 않습니다.
- 이 자료 API는 로그인 없이 누구나 호출할 수 있습니다. 따라서 응답에 들어가는 네 건은 공개되어도 되는 가상 자료뿐이어야 합니다. 실제 자료를 이 테이블이나 API에 연결하지 마세요.
- 서버 함수는 Vercel 환경 변수 `SUPABASE_URL`과 `SUPABASE_SECRET_KEY`를 사용합니다. 프로젝트 설정의 환경 변수 화면에서 직접 등록하세요. 비밀 키는 브라우저 코드, 응답, 로그 또는 Git에 넣지 않습니다. 함수는 오류 상세나 키를 로그로 남기지 않습니다.
- Vercel 빌드는 공개 `data.json`을 만들지 않습니다. 배포 빌드는 Vercel Git/배포 정보를 검증해 `/aleph.json`을 계속 생성합니다.

## 설정 및 실행

Supabase에 `learning_notes` 테이블을 준비하고 네 가상 메모를 넣습니다. 테이블은 RLS가 켜져 있어야 하며 브라우저 역할에 읽기 권한을 주지 않습니다. `owner_id`는 UUID 열이며 `auth.users` 외래키를 사용하지 않습니다. 서버 함수만 Vercel의 서버 전용 `SUPABASE_SECRET_KEY`로 읽습니다.

Vercel 프로젝트 설정의 Environment Variables에 `SUPABASE_URL`과 `SUPABASE_SECRET_KEY`를 등록한 뒤 `main`에 푸시해 배포합니다. 정상 동작은 `/`에 가상 메모 네 건이 표시되고 `/aleph.json`에 현재 저장소·커밋·배포 주소가 나오는 것입니다. 환경 변수가 없거나 데이터베이스 읽기가 실패하면 화면에는 일반 오류만 표시되고 키나 서버 오류 상세는 노출되지 않습니다.

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

현재 정적 파일은 `/`와 `/aleph.json`에서 네 문장을 찾지 못하고, `/data.json`은 404여야 합니다. 공개 `/api/notes` 응답에서 네 문장이 발견되는 것은 현재 의도된 동작입니다. 이 API에는 인증이 없으므로 누구나 이 네 가상 메모를 읽을 수 있습니다. 실제 자료가 API 응답에 섞이면 안 됩니다.

### GitHub `main` 최신 파일

저장소 루트에서 원격 `main`의 최신 커밋을 가져온 뒤, 배포 자료와 API의 고정 가상 문장을 검색합니다.

```sh
git fetch origin main
git grep -n -F -e '실습용 가상 과제 기록' -e '실습용 가상 포트폴리오 기록' -e '실습용 가상 리추얼 기록' -e '실습용 가상 행정 기록' FETCH_HEAD -- data.json api/notes.js public
```

현재 구성에서는 검색 결과가 원본 학습 fixture `data.json`과 API의 가상 자료 허용 목록 `api/notes.js`에 나오는 것이 예상됩니다. `public/data.json`은 없어야 하며 `public/index.html`에는 메모 문장이 없어야 합니다. 검색 결과가 없을 때 `git grep`은 종료 코드 1을 반환합니다.

이 검사는 현재 Production 응답과 현재 GitHub `main`만 확인합니다. 공개된 옛 커밋이나 이전 Vercel 배포가 남아 있으면 과거 노출이 해소됐다고 쓰지 마세요. 과거 커밋은 `git log --all -S'<문장>' --oneline -- data.json public/data.json`으로, 이전 배포는 Vercel의 **Deployments** 목록에서 각각 확인하고 접근 가능 상태인지 별도로 점검합니다.

## 다음 단계의 코딩 도구에 전달할 규칙

[AGENTS.md](AGENTS.md)를 먼저 읽히고 한 번에 한 제작 단위만 요청하세요. 이후 단계의 로그인, 허용 경로, 원본 API 주소, 정책 규칙은 해당 단계 원고와 계약에 맞춰 추가합니다. 비밀번호·토큰·서버 전용 키·실제 학생 기록을 코드, Git, 제출 묶음에 넣지 않습니다.

`src/decider.mjs`와 `src/detect.mjs`의 로컬 시험은 반 엔진이나 운영 심판의 결과가 아닙니다. 제출 묶음 계약 `aleph.defense.submission.v2`는 `scripts/bundle.mjs`에 남아 있으며, 코딩 도구가 해당 단계의 최신 배포 주소와 Git 원격을 맞춘 뒤 사용합니다.
