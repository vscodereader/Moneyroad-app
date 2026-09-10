# Moneyroad — 앱·웹·실시간 서버 개발 기록

## 1. 프로젝트 개요

Moneyroad는 관심종목, 시세·시그널, 뉴스, 토론과 알림을 연결하는 모바일 중심 투자 정보 서비스임. `apps/native`의 React Native·Expo 앱, `apps/web`의 웹 화면, `apps/company`의 회사 소개, `apps/server`의 API, `apps/realtime`의 실시간 데이터 처리를 모노레포로 관리함.

개인 기여는 사용자 확인에 따라 GitHub `vscodereader`와 `jonghyeon`을 포함함. Git author의 `jonghyeon.kim`, `Jonghyeon Kim` 표기도 함께 조사함. `mkvista`의 커밋은 전체 프로젝트 이력에 보존하지만 이번에 본인 계정이라고 확인받지 않았으므로 개인 기여 집계에 자동 합산하지 않음.

## 2. 사용 기술과 적용 위치

### React Native·Expo·Expo Router

- 적용 위치: `apps/native/app/`, `apps/native/src/screens/`.
- 홈·관심종목·시세·뉴스·시그널·종목 토론·계정 화면과 역할별 탐색을 구성함.
- Expo Router로 화면 전환, Safe Area·keyboard-controller로 입력과 키보드 위치, Reanimated·gesture-handler와 bottom sheet로 터치 상호작용을 구현함.
- HeroUI Native·Uniwind를 UI와 테마에 사용함. 공용 `MrBottomSheet`로 반복되던 액션시트의 뼈대를 통합하는 커밋 이력이 있음.

### TypeScript·oRPC·TanStack Query·Zod

- API 타입을 공용 `packages/api`에서 공유하고 앱·웹에서 oRPC로 호출함.
- TanStack Query는 뉴스·관심종목·시그널 조회와 캐시 갱신에 사용함. 실시간 이벤트를 받으면 관련 query를 무효화하여 최신 서버 데이터를 가져옴.
- Zod는 API 입력과 환경 설정 검증에 사용함. 화면 값만 바꾸고 서버 데이터 계약이 어긋나는 변경을 피하도록 타입·검증을 함께 유지함.

### Next.js·React·공용 UI

- 웹 랜딩은 관심종목 → 알림 → 뉴스 → 토론의 이용 흐름으로 재구성함(PR #34).
- 회사 소개 사이트는 별도 앱에서 정보 구조와 서비스 소개를 재설계함(PR #38, RFC 0010).
- `packages/ui`를 재사용하고 공개 페이지의 링크·다운로드 CTA·인증 복귀와 접근성을 함께 다룸.

### Fastify·실시간 서비스 분리

- `apps/server`는 계정·뉴스·토론·관리자 쓰기 API를 담당하고 `apps/realtime`은 외부 데이터 수집·시세·뉴스·시그널 이벤트와 푸시를 담당함.
- `apps/realtime/src/plugins/`에서 quotes·news·signal·discussion·internal·scheduler 경로를 분리함.
- 내부 HTTP 호출로 화면 갱신과 사용자 알림을 연결함. 외부 공개 API와 내부 호출의 인증 경계를 구분함.

### KIS API·뉴스 API·Gemini

- `apps/realtime/src/services/feed/kis.ts`, `kis-throttle.ts`, `stock-master/`에서 시세 연동·호출 제한·종목마스터 처리를 구성함.
- 뉴스는 `services/news/collector.ts`, `naver.ts`, `parser.ts`, `stock-matcher.ts`, `ai.ts`에서 수집·파싱·종목 관련성과 분류 처리를 나눔.
- PR #24는 네이버 뉴스 검색 API의 NCP API HUB 변경 대응이며, #26은 뉴스 개편·관리자 작성·썸네일·토론 관리 통합임.
- AI 분류 코드가 존재하는 사실과 사람이 작성한 개별 투자 시그널을 구분함. 자동 투자 판단 엔진 전체를 구현했다고 표현하지 않음.

### SSE·AppState·실시간 캐시 갱신

- `services/hub.ts`, `refresh-hub.ts`, `plugins/refresh-channel.ts` 등에서 실시간 전달 채널을 구성함.
- 앱의 백그라운드 전환·복귀 시 연결을 정리하고 재연결하여 오래된 연결이 중복으로 남는 문제를 다룸.
- 토론·시그널 갱신의 공통 부분을 서버 채널과 앱 `useRefreshStream`으로 묶는 리팩터링 이력이 있음.
- 메시지 생성·삭제·차단 후 서버 상태와 화면 캐시가 맞는지 확인하고 이벤트 수신만으로 모든 데이터가 최신이라고 가정하지 않음.

### PostgreSQL·Drizzle ORM

- `packages/db`에서 사용자·관심종목·뉴스·토론방·멤버·시그널·알림 이력을 정의함.
- CONTEXT의 DiscussionRoom·Member·Admin 용어와 실제 스키마·API 관계를 맞춤.
- DB 변경은 migration 파일과 journal에 기록함. `hold_signal` enum 추가는 관망 알림을 이력에 저장할 수 있도록 한 변경임.

### Expo Notifications·사용자 설정별 푸시

- 적용 위치: `apps/realtime/src/services/signal-push.ts`, `news/expo-push.ts`, `apps/native/src/lib/push.ts`.
- 시그널 생성 → 내부 알림 호출 → 관심종목 보유자 조회 → 액션별 알림 설정 확인 → Expo 발송 흐름을 구현함.
- `buy`, `sell`, `hold`를 각각의 설정과 연결함. 설정 행이 없을 때 매수·매도는 true, 관망은 false라는 DB 기본값을 코드와 맞춤.
- 현재 앱의 관심종목 타입이 `news`이므로 시그널 발송 대상 조회도 해당 값으로 수행함. 이름만 보고 `signal`로 조회하면 대상이 없어지는 문제를 방지함.
- 화면 refresh는 추가·삭제에 모두 필요하지만 푸시는 생성 시에만 필요하므로 두 내부 동작을 분리함.
- 발송 실패는 개별 사용자 단위로 격리하고 시그널 생성 자체가 실패하지 않도록 함. 실제 기기 수신 검증은 서버 코드·PR 검증과 별도 항목임.

### Better Auth·SecureStore·로그인 복귀

- 세션과 이메일·소셜 인증을 공용 인증 패키지로 처리함.
- 비회원이 볼 수 있는 공개 범위와 로그인이 필요한 행동을 구분하고 로그인 후 원래 화면으로 복귀하도록 구성함(PR #37, RFC 0009).
- 온보딩 완료 상태와 실제 세션을 연결하여 앱 재시작·로그아웃·재로그인 시 화면 흐름을 맞춤.

### 문서 피커·SAF·MediaLibrary·파일 공유

- 적용 위치: `apps/native/src/lib/discussion-upload.ts`, `discussion-download.ts`, 토론방의 파일·이미지 말풍선과 뷰어.
- 파일 첨부는 시스템 문서 피커로 사용자가 선택하며 기기 내부 절대경로를 하드코딩하지 않음.
- Android 파일 저장은 SAF 디렉터리 선택과 URI 권한을 이용하고 이미지는 MediaLibrary의 갤러리 저장 흐름을 사용함.
- 서버의 인증된 첨부 프록시로 바이트를 받은 뒤 로컬 URI로 외부 앱에 넘기는 구조를 사용함. 클라우드 첨부 URL을 외부 앱에 그대로 공개하는 흐름과 구분함.
- RFC 0004·0005·0008과 PR #28에서 첨부·저장·열기·답글·내 글/답글을 함께 다룸.

### Docker·Cloud Run·EAS·GitHub Actions

- 서버·실시간 프로세스를 배포 구성에 따라 분리하고 컨테이너·CI 설정으로 실행 환경을 관리함.
- Expo EAS는 개발·preview·production·staging 빌드와 Android/iOS 제출 프로필을 제공함.
- 의존성 설치 위치·작업 디렉터리·Expo 환경 값 번들링과 SSE 복귀 처리는 초기 Git 이력에서 확인 가능한 문제 해결 항목임.
- `.env` 값은 개인 저장소 복사에서 제외함. 빌드 스크립트가 존재하는 사실만으로 현재 스토어 배포가 완료됐다고 단정하지 않음.

## 3. 본인 PR과 개발 이력

1. jonghyeon 계정 및 대응 Git author: 초기 모노레포·네이티브 기반, 서버·실시간 데이터, 인증·배포 관련 커밋과 develop 통합 PR을 포함하여 조사함.
2. #24: 뉴스 API의 NCP API HUB 변경에 대응함.
3. #26: 뉴스 분류·관리자 뉴스 작성·썸네일·토론 관리·실시간 카운트를 통합함.
4. #28: 토론방 모더레이션·SSE·즐겨찾기·검색·첨부·답글을 구현함.
5. #30: 썸네일 없는 뉴스의 기본 이미지, 관리자 업로드와 독점·요약 표시를 구현함.
6. #32: 시그널 추가·삭제 후 화면 갱신, 생성 시 사용자별 알림을 보완함.
7. #34: 웹 랜딩의 정보 구조와 앱 이용 흐름을 재설계함.
8. #37: 비로그인 접근 정책·로그인 복귀·계정 온보딩을 구현함.
9. #38: 머니게이트 회사 소개 웹사이트를 재설계함.
10. #39: jonghyeon의 develop 통합 PR을 포함함.

위 목록 외의 팀 PR도 전체 목록에 보존함. 로컬 `all_in_one`, 재스택·백업 브랜치의 커밋을 수집하여 원격 main에만 남은 이력으로 기여를 제한하지 않음. 같은 수정의 cherry-pick·재작성은 SHA가 다를 수 있으므로 커밋 개수를 기능 개수로 해석하지 않음.

## 4. 트러블슈팅 기록

### 시그널을 추가·삭제해도 화면이 갱신되지 않음

- 관측: 관리자 쓰기 API와 클라이언트 캐시·실시간 서버가 분리되어 있음.
- 수정: 내부 refresh 경로와 앱 캐시 무효화를 연결하고 토론·시그널 공통 refresh 코드를 재사용함.
- 알림 보완: 생성 이벤트만 푸시로 연결하고 삭제는 화면 갱신만 수행하도록 구분함.
- 근거: PR #32, RFC 0007, `signal-push.ts`, `realtime-trigger.ts`.

### 관망 알림 설정과 실제 알림 저장이 불일치함

- 원인: 액션·설정은 3종인데 알림 enum의 관망 값이 빠진 상태였음.
- 수정: `hold_signal` migration과 액션별 메타데이터를 추가하고 기본 OFF 조건을 유지함.
- 문서의 이전 초안에는 migration 불필요 문장이 남아 있어 실제 코드·migration을 우선 근거로 삼음.

### 모바일 첨부를 받은 뒤 저장·열기가 불완전함

- 수정: 사진 저장, 파일 다운로드, 외부 앱 열기를 별도 행동으로 구성함.
- 확인: Android URI 접근과 iOS 공유·사진 권한을 플랫폼별로 구분함. 첨부 접근 권한·파일명·MIME·다운로드 실패를 처리하는 흐름을 문서와 맞춤.
- 근거: PR #28와 RFC 0005. 설계 문서에 Draft 표시가 남은 부분은 구현 여부를 코드와 대조하여 판단함.

## 5. 개발 방법·스킬·검증

- CONTEXT·AGENTS·RFC에 용어, 권한, API 계약, 결정과 예외를 고정함.
- 작업별 브랜치에서 공용 UI·타입·서비스를 재사용하고 스택 통합 시 migration·실시간 이벤트·화면 캐시를 함께 확인함.
- 설치 스킬은 `skills-lock.json`에서 인증·Expo·데이터 요청·Next.js·UI·Turborepo·Ultracite·로그·브라우저 검증 범주로 확인함. 설치된 스킬과 실제 호출 기록은 같은 증거로 취급하지 않음.
- 실측 토큰 기록이 없으므로 절감률을 새로 산정하지 않음. RFC 재사용·도메인 용어 고정·관련 패키지만 검사하여 반복 설명과 탐색을 줄였다고 기록함.
- 이번 문서화는 Git·코드·PR·대화의 증거 정리이며, 시세 API 호출·운영 DB 변경·푸시 발송을 다시 실행하지 않음.

## 6. 전체 자료 열람

`portfolio/PR-INDEX.md`는 팀 전체 PR과 본인 여부, `portfolio/prs/`는 본인 PR 본문·파일·커밋·리뷰, `portfolio/COMMITS.md`는 author를 보존한 Git 이력, `portfolio/BRANCHES.md`와 `WORK-IN-PROGRESS.md`는 원격·로컬·미커밋 작업의 보존 위치를 제공함. 원본의 설계·매뉴얼·RFC는 코드와 함께 유지함.
