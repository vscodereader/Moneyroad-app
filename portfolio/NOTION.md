## 프로젝트 개요
Moneyroad는 **관심종목·시세·뉴스·시그널·토론·알림을 연결하는 투자 정보 서비스**임. 모바일 앱을 중심으로 웹 랜딩·회사 소개·API·실시간 서버를 함께 개발함.
## 핵심 기능
- **시장 정보**: 관심종목·시세·종목 검색·뉴스·시그널
- **소통**: 토론방·메시지·답글·검색·즐겨찾기·첨부 저장
- **알림·계정**: 사용자 설정별 푸시·로그인 복귀·온보딩
- **운영·웹**: 관리자 뉴스·토론 관리·앱 랜딩·회사 소개
## 기술 구성
- **앱**: React Native·Expo·Expo Router·TypeScript
- **웹**: Next.js·React·공용 UI
- **서버·데이터**: Fastify·oRPC·TanStack Query·PostgreSQL·Drizzle
- **실시간·외부 연동**: SSE·KIS·뉴스 API·Gemini 분류·Expo Notifications
- **인증·배포**: Better Auth·SecureStore·Docker·Cloud Run·EAS
## 구현 구조
1. **apps/native** — 투자 정보 앱의 화면과 네이티브 기능을 담당함.
2. **apps/web·apps/company** — 앱 소개 랜딩과 회사 소개를 제공함.
3. **apps/server** — 사용자·관리자 쓰기와 비즈니스 API를 담당함.
4. **apps/realtime** — 외부 데이터 수집·실시간 스트림·이벤트·푸시를 처리함.
5. **packages** — API 계약·인증·DB·공용 UI를 공유함.
## 사용 기술 — 어디에, 왜 사용했는지
<details>
<summary>React Native·Expo·Expo Router</summary>
	- 적용 위치: `apps/native/app/`, `apps/native/src/screens/`.
	- 홈·관심종목·시세·뉴스·시그널·종목 토론·계정 화면과 역할별 탐색을 구성함.
	- Expo Router로 화면 전환, Safe Area·keyboard-controller로 입력과 키보드 위치, Reanimated·gesture-handler와 bottom sheet로 터치 상호작용을 구현함.
	- HeroUI Native·Uniwind를 UI와 테마에 사용함. 공용 `MrBottomSheet`로 반복되던 액션시트의 뼈대를 통합하는 커밋 이력이 있음.
</details>
<details>
<summary>TypeScript·oRPC·TanStack Query·Zod</summary>
	- API 타입을 공용 `packages/api`에서 공유하고 앱·웹에서 oRPC로 호출함.
	- TanStack Query는 뉴스·관심종목·시그널 조회와 캐시 갱신에 사용함. 실시간 이벤트를 받으면 관련 query를 무효화하여 최신 서버 데이터를 가져옴.
	- Zod는 API 입력과 환경 설정 검증에 사용함. 화면 값만 바꾸고 서버 데이터 계약이 어긋나는 변경을 피하도록 타입·검증을 함께 유지함.
</details>
<details>
<summary>Next.js·React·공용 UI</summary>
	- 웹 랜딩은 관심종목 → 알림 → 뉴스 → 토론의 이용 흐름으로 재구성함(PR #34).
	- 회사 소개 사이트는 별도 앱에서 정보 구조와 서비스 소개를 재설계함(PR #38, RFC 0010).
	- `packages/ui`를 재사용하고 공개 페이지의 링크·다운로드 CTA·인증 복귀와 접근성을 함께 다룸.
</details>
<details>
<summary>Fastify·실시간 서비스 분리</summary>
	- `apps/server`는 계정·뉴스·토론·관리자 쓰기 API를 담당하고 `apps/realtime`은 외부 데이터 수집·시세·뉴스·시그널 이벤트와 푸시를 담당함.
	- `apps/realtime/src/plugins/`에서 quotes·news·signal·discussion·internal·scheduler 경로를 분리함.
	- 내부 HTTP 호출로 화면 갱신과 사용자 알림을 연결함. 외부 공개 API와 내부 호출의 인증 경계를 구분함.
</details>
<details>
<summary>KIS API·뉴스 API·Gemini</summary>
	- `apps/realtime/src/services/feed/kis.ts`, `kis-throttle.ts`, `stock-master/`에서 시세 연동·호출 제한·종목마스터 처리를 구성함.
	- 뉴스는 `services/news/collector.ts`, `naver.ts`, `parser.ts`, `stock-matcher.ts`, `ai.ts`에서 수집·파싱·종목 관련성과 분류 처리를 나눔.
	- PR #24는 네이버 뉴스 검색 API의 NCP API HUB 변경 대응이며, #26은 뉴스 개편·관리자 작성·썸네일·토론 관리 통합임.
	- AI 분류 코드가 존재하는 사실과 사람이 작성한 개별 투자 시그널을 구분함. 자동 투자 판단 엔진 전체를 구현했다고 표현하지 않음.
</details>
<details>
<summary>SSE·AppState·실시간 캐시 갱신</summary>
	- `services/hub.ts`, `refresh-hub.ts`, `plugins/refresh-channel.ts` 등에서 실시간 전달 채널을 구성함.
	- 앱의 백그라운드 전환·복귀 시 연결을 정리하고 재연결하여 오래된 연결이 중복으로 남는 문제를 다룸.
	- 토론·시그널 갱신의 공통 부분을 서버 채널과 앱 `useRefreshStream`으로 묶는 리팩터링 이력이 있음.
	- 메시지 생성·삭제·차단 후 서버 상태와 화면 캐시가 맞는지 확인하고 이벤트 수신만으로 모든 데이터가 최신이라고 가정하지 않음.
</details>
<details>
<summary>PostgreSQL·Drizzle ORM</summary>
	- `packages/db`에서 사용자·관심종목·뉴스·토론방·멤버·시그널·알림 이력을 정의함.
	- CONTEXT의 DiscussionRoom·Member·Admin 용어와 실제 스키마·API 관계를 맞춤.
	- DB 변경은 migration 파일과 journal에 기록함. `hold_signal` enum 추가는 관망 알림을 이력에 저장할 수 있도록 한 변경임.
</details>
<details>
<summary>Expo Notifications·사용자 설정별 푸시</summary>
	- 적용 위치: `apps/realtime/src/services/signal-push.ts`, `news/expo-push.ts`, `apps/native/src/lib/push.ts`.
	- 시그널 생성 → 내부 알림 호출 → 관심종목 보유자 조회 → 액션별 알림 설정 확인 → Expo 발송 흐름을 구현함.
	- `buy`, `sell`, `hold`를 각각의 설정과 연결함. 설정 행이 없을 때 매수·매도는 true, 관망은 false라는 DB 기본값을 코드와 맞춤.
	- 현재 앱의 관심종목 타입이 `news`이므로 시그널 발송 대상 조회도 해당 값으로 수행함. 이름만 보고 `signal`로 조회하면 대상이 없어지는 문제를 방지함.
	- 화면 refresh는 추가·삭제에 모두 필요하지만 푸시는 생성 시에만 필요하므로 두 내부 동작을 분리함.
	- 발송 실패는 개별 사용자 단위로 격리하고 시그널 생성 자체가 실패하지 않도록 함. 실제 기기 수신 검증은 서버 코드·PR 검증과 별도 항목임.
</details>
<details>
<summary>Better Auth·SecureStore·로그인 복귀</summary>
	- 세션과 이메일·소셜 인증을 공용 인증 패키지로 처리함.
	- 비회원이 볼 수 있는 공개 범위와 로그인이 필요한 행동을 구분하고 로그인 후 원래 화면으로 복귀하도록 구성함(PR #37, RFC 0009).
	- 온보딩 완료 상태와 실제 세션을 연결하여 앱 재시작·로그아웃·재로그인 시 화면 흐름을 맞춤.
</details>
<details>
<summary>문서 피커·SAF·MediaLibrary·파일 공유</summary>
	- 적용 위치: `apps/native/src/lib/discussion-upload.ts`, `discussion-download.ts`, 토론방의 파일·이미지 말풍선과 뷰어.
	- 파일 첨부는 시스템 문서 피커로 사용자가 선택하며 기기 내부 절대경로를 하드코딩하지 않음.
	- Android 파일 저장은 SAF 디렉터리 선택과 URI 권한을 이용하고 이미지는 MediaLibrary의 갤러리 저장 흐름을 사용함.
	- 서버의 인증된 첨부 프록시로 바이트를 받은 뒤 로컬 URI로 외부 앱에 넘기는 구조를 사용함. 클라우드 첨부 URL을 외부 앱에 그대로 공개하는 흐름과 구분함.
	- RFC 0004·0005·0008과 PR #28에서 첨부·저장·열기·답글·내 글/답글을 함께 다룸.
</details>
<details>
<summary>Docker·Cloud Run·EAS·GitHub Actions</summary>
	- 서버·실시간 프로세스를 배포 구성에 따라 분리하고 컨테이너·CI 설정으로 실행 환경을 관리함.
	- Expo EAS는 개발·preview·production·staging 빌드와 Android/iOS 제출 프로필을 제공함.
	- 의존성 설치 위치·작업 디렉터리·Expo 환경 값 번들링과 SSE 복귀 처리는 초기 Git 이력에서 확인 가능한 문제 해결 항목임.
	- `.env` 값은 개인 저장소 복사에서 제외함. 빌드 스크립트가 존재하는 사실만으로 현재 스토어 배포가 완료됐다고 단정하지 않음.
</details>
## 개인 기여와 작업 이력
**vscodereader·jonghyeon**과 대응 Git author를 포함함. mkvista는 팀 전체 이력에 보존하되 본인으로 자동 합산하지 않음.
<details>
<summary>본인 PR과 초기 개발·통합 이력</summary>
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
</details>
## 트러블슈팅
<details>
<summary>시그널을 추가·삭제해도 화면이 갱신되지 않음</summary>
	- 관측: 관리자 쓰기 API와 클라이언트 캐시·실시간 서버가 분리되어 있음.
	- 수정: 내부 refresh 경로와 앱 캐시 무효화를 연결하고 토론·시그널 공통 refresh 코드를 재사용함.
	- 알림 보완: 생성 이벤트만 푸시로 연결하고 삭제는 화면 갱신만 수행하도록 구분함.
	- 근거: PR #32, RFC 0007, `signal-push.ts`, `realtime-trigger.ts`.
</details>
<details>
<summary>관망 알림 설정과 실제 알림 저장이 불일치함</summary>
	- 원인: 액션·설정은 3종인데 알림 enum의 관망 값이 빠진 상태였음.
	- 수정: `hold_signal` migration과 액션별 메타데이터를 추가하고 기본 OFF 조건을 유지함.
	- 문서의 이전 초안에는 migration 불필요 문장이 남아 있어 실제 코드·migration을 우선 근거로 삼음.
</details>
<details>
<summary>모바일 첨부를 받은 뒤 저장·열기가 불완전함</summary>
	- 수정: 사진 저장, 파일 다운로드, 외부 앱 열기를 별도 행동으로 구성함.
	- 확인: Android URI 접근과 iOS 공유·사진 권한을 플랫폼별로 구분함. 첨부 접근 권한·파일명·MIME·다운로드 실패를 처리하는 흐름을 문서와 맞춤.
	- 근거: PR #28와 RFC 0005. 설계 문서에 Draft 표시가 남은 부분은 구현 여부를 코드와 대조하여 판단함.
</details>
## 개발 전 준비·코드 리뷰·사용 스킬
- CONTEXT·AGENTS·RFC에 용어, 권한, API 계약, 결정과 예외를 고정함.
- 작업별 브랜치에서 공용 UI·타입·서비스를 재사용하고 스택 통합 시 migration·실시간 이벤트·화면 캐시를 함께 확인함.
- 설치 스킬은 `skills-lock.json`에서 인증·Expo·데이터 요청·Next.js·UI·Turborepo·Ultracite·로그·브라우저 검증 범주로 확인함. 설치된 스킬과 실제 호출 기록은 같은 증거로 취급하지 않음.
- 실측 토큰 기록이 없으므로 절감률을 새로 산정하지 않음. RFC 재사용·도메인 용어 고정·관련 패키지만 검사하여 반복 설명과 탐색을 줄였다고 기록함.
- 이번 문서화는 Git·코드·PR·대화의 증거 정리이며, 시세 API 호출·운영 DB 변경·푸시 발송을 다시 실행하지 않음.
## 전체 자료와 보존 기록
`portfolio/PR-INDEX.md`는 팀 전체 PR과 본인 여부, `portfolio/prs/`는 본인 PR 본문·파일·커밋·리뷰, `portfolio/COMMITS.md`는 author를 보존한 Git 이력, `portfolio/BRANCHES.md`와 `WORK-IN-PROGRESS.md`는 원격·로컬·미커밋 작업의 보존 위치를 제공함. 원본의 설계·매뉴얼·RFC는 코드와 함께 유지함.
- [개인 저장소 — Moneyroad-app](https://github.com/vscodereader/Moneyroad-app)
- [전체 PR·본문·변경 파일·리뷰](https://github.com/vscodereader/Moneyroad-app/blob/portfolio/portfolio/PR-INDEX.md)
<details>
<summary>이전 상세 정리와 날짜별 기록 — 원문 보존</summary>
	**1. 어떤 프로젝트인지**<br>moneyroad는 투자자의 일일 의사결정 흐름을 중심으로 관심종목, 시세·시그널, 뉴스, 종목 토론, 알림, 계정 작업을 묶은 모바일 중심 투자 보조 서비스입니다. Next.js 웹, React Native·Expo 앱, Fastify 서버, oRPC API, Drizzle·PostgreSQL, Better Auth, 공유 shadcn UI, Turborepo로 구성했습니다.**<br>2. 어떻게 구현했는지**<br>apps/web·native·server와 packages/ui·api·auth·db로 책임을 나눴습니다. DB 스키마에서 API router, 서버 transport, 웹·네이티브 화면까지 workspace 타입을 공유했습니다. DiscussionRoom, Member, Admin의 관계와 권한을 CONTEXT에 고정해 UI·API·DB가 같은 언어를 사용했습니다.<br>초기에는 develop을 main에 합치는 통합 PR로 기반을 만들고, 이후 RFC와 작업별 브랜치로 뉴스 썸네일, 시그널 갱신, 랜딩 페이지, 인증·온보딩, 회사 소개 사이트를 사용자 흐름 단위로 구현했습니다. 개인 기여는 사용자 확인에 따라 jonghyeon·vscodereader 및 대응 Git author로 집계함. mkvista 이력은 프로젝트 전체 기록에 보존하되 본인 기여로 자동 합산하지 않음.**<br>3. 사용한 스킬**<br>agent-browser, ai-sdk, analyze-logs, better-auth-best-practices, building-native-ui, Expo CI/CD·deployment·dev-client·Tailwind, native-data-fetching, next-best-practices, next-cache-components, review-logging-patterns, shadcn, turborepo, ultracite, Vercel React·composition·React Native best practices, web-design-guidelines를 사용했습니다.<br>Better-T-Stack, Context7, shadcn, Next DevTools, Better Auth, Expo, KIS Code Assistant MCP를 연결해 프레임워크 문서와 생성 도구를 작업 안에서 조회했습니다.**<br>4. 만들기 전 진행한 과정**<br>서비스 핵심 용어와 관계를 CONTEXT에 먼저 정리했습니다. 목업의 Thread를 DiscussionRoom으로 통일하고 비로그인 공개 범위, 첫 메시지 전송 시 Member 생성 규칙을 확정했습니다. 기능별 RFC와 docs/superpowers/specs·plans에 목적, 범위, 데이터 계약, 화면 흐름, 검증 항목을 기록했습니다. 기존 패키지 경계와 재사용 가능한 UI·서비스를 조사한 뒤 최신 develop의 worktree에서 구현했습니다.**<br>5. 코드 생성과 코드 리뷰**<br>Claude는 RFC나 계획서의 완료 조건을 기준으로 파일별 구현을 생성했습니다. Write/Edit 뒤 pnpm fix 훅이 실행되어 포맷과 단순 린트 문제를 즉시 제거했습니다. Ultracite·Biome으로 타입 안전성, 접근성, React hook, import, 복잡도, 보안 패턴을 검사했습니다. PR에는 변경 목적, 작업 내용, 검증 결과를 기록하고 DB·API·웹·네이티브 타입 검사와 기능별 테스트를 수행했습니다.**<br>6. 토큰을 줄인 방법**<br>CONTEXT에 도메인 언어와 결정을 고정하고 AGENTS·스킬 폴더에 코딩 규칙과 프레임워크 지식을 저장했습니다. RFC·plan을 다음 세션의 압축 입력으로 사용하고 필요한 앱·패키지만 Turborepo filter로 검사했습니다. 공유 패키지를 단일 진실 공급원으로 사용해 컴포넌트·타입·인증 로직의 중복 생성을 줄였습니다.**<br>7. 에러와 트러블슈팅**<br>Expo EAS 빌드에서는 의존성 설치 위치와 작업 디렉터리를 교정하고, Expo 빌드 시 누락되던 환경 변수를 번들에 안전하게 인라인했습니다. 모바일 SSE는 백그라운드 복귀 후 남는 좀비 연결을 AppState 전환에서 정리하고 재연결했습니다. 제품 기능에서는 React Query 캐시 무효화, 로그인 복귀 URL, 비로그인 보호 경계, 알림 생성 시점을 기능별 테스트와 RFC로 해결했습니다.<br>[GitHub 저장소](https://github.com/beyondsoft-kr/moneyroad-app)
	**3-A. 스킬 상세 분석**<br>**읽는 방법**: 아래 절감량은 실제 토큰 계측값이 아니라 해당 종류의 작업 한 건을 수행할 때의 추정 범위입니다. 여러 스킬이 동시에 적용되므로 범위를 서로 더하지 않았습니다.**<br>브라우저·진단**<br>• **agent-browser** — 외부 스킬을 jonghyeon 계정으로 저장소에 추가했습니다.사용 시점: 웹 화면 이동, 폼 입력, 반응형 화면과 사용자 흐름을 실제 브라우저에서 확인할 때 사용했습니다.만든 결과: 로그인·랜딩·회사 소개 등 웹 화면의 동작 검증 절차를 표준화했습니다.토큰 절감 추정: 브라우저 검증 작업당 약 15\~35%를 줄였습니다. 화면 구조 전체를 매번 설명하고 수동 결과를 다시 전달하는 대신 필요한 요소를 찾아 조작하고 결과만 회수해 탐색 대화와 재현 설명을 줄였기 때문입니다.<br>• **analyze-logs** — 외부 스킬입니다.사용 시점: 서버와 실시간 기능의 구조화 로그를 분석할 때 사용했습니다.만든 결과: KIS 시세, 뉴스 수집, SSE 연결 문제를 요청 단위의 이벤트로 좁혀 진단하는 기준을 만들었습니다.토큰 절감 추정: 로그 분석 작업당 약 30\~60%를 줄였습니다. 전체 로그를 대화에 넣지 않고 오류 시각·요청 ID·이벤트 종류로 필터링한 뒤 관련 행만 읽어 긴 반복 로그의 입력을 크게 줄였기 때문입니다.<br>• **review-logging-patterns** — 외부 스킬입니다.사용 시점: 서버 로깅을 검토하거나 새 서비스의 관측 항목을 설계할 때 사용했습니다.만든 결과: 흩어진 console 출력 대신 evlog 기반의 구조화 이벤트와 넓은 요청 문맥을 남기는 방향을 적용했습니다.토큰 절감 추정: 로깅 설계·리뷰당 약 20\~40%를 줄였습니다. 어떤 필드를 남겨야 하는지 처음부터 다시 논의하지 않고 정해진 체크리스트로 누락만 확인했기 때문입니다.**<br>인증·데이터·Next.js**<br>• **better-auth-best-practices** — 외부 스킬입니다.사용 시점: 이메일·소셜 로그인, 세션, 보호 라우트, 로그아웃과 온보딩을 구현할 때 사용했습니다.만든 결과: Google·Apple·Naver·Kakao 로그인, AuthGate, 실제 세션 프로필과 로그인 복귀 흐름을 구성했습니다.토큰 절감 추정: 인증 작업당 약 20\~40%를 줄였습니다. 서버·클라이언트 설정, 세션 처리, 환경 변수와 보안 점검을 매번 문서 전체에서 찾지 않고 인증 관련 절차만 불러왔기 때문입니다.<br>• **native-data-fetching** — 외부 스킬입니다.사용 시점: Expo 앱에서 oRPC·React Query·SSE 데이터를 연결할 때 사용했습니다.만든 결과: 관심종목, 뉴스, 시그널, 알림, 종목 상세와 토론방의 실데이터 연결 및 캐시 무효화 흐름을 구현했습니다.토큰 절감 추정: 데이터 연결 작업당 약 20\~40%를 줄였습니다. 요청·로딩·오류·캐시·재연결 패턴을 반복 설계하지 않고 해당 패턴과 관련 파일만 확인했기 때문입니다.<br>• **next-best-practices** — 외부 스킬입니다.사용 시점: Next.js App Router 페이지와 서버·클라이언트 경계를 구현하고 리뷰할 때 사용했습니다.만든 결과: 랜딩 페이지와 회사 소개 사이트의 라우팅, 메타데이터, 이미지, 오류 경계를 정리했습니다.토큰 절감 추정: Next.js 화면 작업당 약 15\~30%를 줄였습니다. 프레임워크 전체 문서 대신 파일 규칙, RSC 경계, 데이터 처리와 성능 항목만 점검했기 때문입니다.<br>• **next-cache-components** — 외부 스킬이며 저장소에 설치했습니다.사용 시점: Next.js 캐시·재검증·부분 사전 렌더링 판단이 필요한 때 사용했습니다.만든 결과: 현재 사용자 기여 PR에서 이 스킬을 직접 적용한 독립 기능은 확인되지 않았고, 캐시 구현을 검토하는 기준으로 유지했습니다.토큰 절감 추정: 캐시 관련 작업당 약 20\~40%를 줄입니다. Next.js 버전별 캐시 API를 넓게 재검색하지 않고 use cache, cacheLife, cacheTag와 무효화 조건만 조회하기 때문입니다.**모바일·Expo**<br>• **building-native-ui** — 외부 스킬입니다.사용 시점: Expo Router 화면, 탭, 리스트, 애니메이션과 모바일 상호작용을 구현할 때 사용했습니다.만든 결과: 온보딩, 홈, 뉴스, 시그널, 토론, 마이페이지와 설정 화면의 네이티브 구조를 만들었습니다.토큰 절감 추정: 모바일 UI 작업당 약 15\~30%를 줄였습니다. 라우팅·안전 영역·키보드·리스트의 공통 결정을 재설명하지 않고 화면별 차이만 다뤘기 때문입니다.<br>• **expo-cicd-workflows** — 외부 스킬입니다.사용 시점: EAS Build·Submit과 GitHub Actions 워크플로를 작성할 때 사용했습니다.만든 결과: Android·iOS 빌드, 제출, staging 프로필과 TestFlight 자동 배포 흐름을 구성했습니다.토큰 절감 추정: CI/CD 작업당 약 20\~40%를 줄였습니다. EAS YAML 구조와 작업 디렉터리·의존성 설치 규칙을 반복 탐색하지 않고 필요한 워크플로 조각만 적용했기 때문입니다.<br>• **expo-deployment** — 외부 스킬입니다.사용 시점: 앱 스토어, TestFlight, 웹·API 배포 경로를 정리할 때 사용했습니다.만든 결과: App Store·Google Play 제출, Cloud Run CD와 배포 문서를 만들었습니다.토큰 절감 추정: 배포 작업당 약 15\~30%를 줄였습니다. 플랫폼별 전체 배포 문서를 읽는 대신 현재 대상의 자격 증명·프로필·제출 단계만 선택했기 때문입니다.<br>• **expo-dev-client** — 외부 스킬입니다.사용 시점: 네이티브 모듈과 푸시 알림을 포함한 개발 빌드가 필요할 때 사용했습니다.만든 결과: expo-notifications를 포함한 실제 기기 검증과 개발 빌드 기준을 정리했습니다.토큰 절감 추정: 개발 클라이언트 문제당 약 10\~25%를 줄였습니다. Expo Go 가능 여부와 재빌드 조건을 바로 판별해 불필요한 설치·실행 시도를 줄였기 때문입니다.<br>• **expo-tailwind-setup** — 외부 스킬이며 설치 상태를 확인했습니다.사용 시점: Expo의 Tailwind v4·NativeWind 계열 스타일 설정을 점검할 때 사용했습니다.만든 결과: 현재 사용자 기여 PR에서 독립적인 설정 도입 결과는 명확히 확인되지 않았고 모바일 스타일 구성의 참조 기준으로 두었습니다.토큰 절감 추정: 초기 스타일 설정당 약 15\~30%를 줄입니다. Metro·Babel·CSS 설정의 호환 조합을 시행착오로 찾지 않고 필요한 설정 파일만 확인하기 때문입니다.<br>• **vercel-react-native-skills** — 외부 스킬입니다.사용 시점: FlatList, 렌더링, 애니메이션, 네이티브 성능을 리뷰할 때 사용했습니다.만든 결과: 뉴스 무한 스크롤, 화면 전환, SSE 생명주기와 목록 렌더링의 성능 점검 기준을 적용했습니다.토큰 절감 추정: React Native 성능 작업당 약 15\~35%를 줄였습니다. 전체 화면을 다시 분석하지 않고 리스트·렌더·애니메이션 병목 체크 항목만 확인했기 때문입니다.**<br>UI·구조·품질**<br>• **shadcn** — 외부 스킬입니다.사용 시점: 공용 웹 UI를 검색·추가·조합하고 접근성을 검토할 때 사용했습니다.만든 결과: packages/ui의 공용 컴포넌트를 랜딩과 회사 소개 페이지에서 재사용했습니다.토큰 절감 추정: 컴포넌트 작업당 약 15\~30%를 줄였습니다. 컴포넌트를 처음부터 생성하지 않고 기존 레지스트리와 프로젝트 컴포넌트에서 필요한 부분만 가져왔기 때문입니다.<br>• **turborepo** — 외부 스킬입니다.사용 시점: apps·packages 경계, task pipeline, filter와 캐시를 다룰 때 사용했습니다.만든 결과: web·native·server와 ui·api·auth·db를 하나의 타입 안전한 모노레포 흐름으로 묶었습니다.토큰 절감 추정: 모노레포 작업당 약 20\~50%를 줄였습니다. 저장소 전체를 매번 읽고 검사하지 않고 영향받는 workspace와 의존 패키지만 탐색·실행했기 때문입니다.<br>• **ultracite** — 외부 스킬입니다.사용 시점: 작성 직후 자동 수정과 PR 전 정적 검사를 수행할 때 사용했습니다.만든 결과: Biome 기반 포맷, import, React hook, 접근성, 복잡도와 안전성 검사를 일관되게 적용했습니다.토큰 절감 추정: 수정·리뷰당 약 10\~25%를 줄였습니다. 기계적으로 고칠 수 있는 오류를 모델에게 설명하고 재수정시키지 않고 도구가 즉시 고쳤기 때문입니다.<br>• **vercel-composition-patterns** — 외부 스킬입니다.사용 시점: props가 비대해지는 React 컴포넌트와 공용 UI API를 설계할 때 사용했습니다.만든 결과: 카드·섹션·레이아웃을 조합 가능한 구조로 유지하는 기준을 적용했습니다.토큰 절감 추정: 컴포넌트 설계당 약 10\~25%를 줄였습니다. compound component·context·slot 패턴에서 적합한 구조를 선택해 대안 탐색을 줄였기 때문입니다.<br>• **vercel-react-best-practices** — 외부 스킬입니다.사용 시점: React·Next.js 성능과 데이터 흐름을 리뷰할 때 사용했습니다.만든 결과: 불필요한 재렌더, 직렬 데이터 요청, 과한 번들 증가를 피하는 검토 기준을 적용했습니다.토큰 절감 추정: 성능 리뷰당 약 10\~30%를 줄였습니다. 코드 전체에 대한 막연한 리뷰 대신 알려진 성능 항목과 변경 파일만 대조했기 때문입니다.<br>• **web-design-guidelines** — 외부 스킬입니다.사용 시점: 랜딩·회사 소개의 접근성, 정보 계층, 반응형과 상호작용을 검토할 때 사용했습니다.만든 결과: 공개 웹 화면의 디자인·접근성 체크리스트를 적용했습니다.토큰 절감 추정: UI 감사당 약 10\~25%를 줄였습니다. 디자인 원칙을 매번 생성하지 않고 화면을 체크리스트에 대조해 수정할 부분만 기록했기 때문입니다.<br>• **ai-sdk** — 외부 스킬이며 설치 상태를 확인했습니다.사용 시점: Vercel AI SDK 기반 생성·스트리밍·도구 호출 기능을 만들 때 사용합니다.만든 결과: 현재 사용자 기여 이력에서 직접 구현된 AI SDK 기능은 확인되지 않았습니다. 향후 AI 브리핑 기능의 구현 기준으로 유지했습니다.토큰 절감 추정: AI 기능 작업당 약 20\~40%를 줄입니다. 공급자별 API와 스트리밍 처리를 직접 조합하지 않고 SDK의 표준 메시지·도구 호출 패턴만 사용하기 때문입니다.<br>• **heroui-native** — 외부 스킬이며 설치 상태를 확인했습니다.사용 시점: HeroUI Native·Uniwind 컴포넌트와 테마를 사용할 때 적용합니다.만든 결과: 현재 사용자 기여 이력에서 직접 적용한 독립 기능은 확인되지 않았습니다.토큰 절감 추정: 해당 UI 도입 작업당 약 10\~25%를 줄입니다. 컴포넌트 API와 테마 토큰을 재설계하지 않고 제공된 패턴을 조합하기 때문입니다.**<br>직접 생성·추가한 스킬과 MCP**<br>이 저장소에서 세 사용자 계정이 내용을 직접 집필한 프로젝트 전용 스킬은 확인되지 않았습니다. skills-lock.json에 기록된 스킬은 외부 제작자의 스킬을 고정한 것입니다. jonghyeon은 2026-05-24에 외부 **agent-browser** 스킬을 저장소에 직접 추가했습니다. Better-T-Stack, Context7, shadcn, Next DevTools, Better Auth, Expo, KIS Code Assistant MCP도 연결해 프레임워크 전체를 대화에 복사하지 않고 필요한 공식 문서·생성 결과만 조회했습니다. MCP 조회는 문서 확인 작업당 약 20\~50%의 입력 토큰을 줄인 것으로 추정합니다.**8. 날짜별 작업 일지**<br>개인 기여는 사용자 확인에 따라 jonghyeon·vscodereader 및 대응 Git author로 집계함. mkvista 이력은 프로젝트 전체 기록에 보존하되 본인 기여로 자동 합산하지 않음.<br>• **2026-05-20** — 최초 모노레포를 설정하고 Biome 규칙을 정리한 뒤 MoneyRoad 네이티브 앱의 주요 화면 골격을 만들었습니다.<br>• **2026-05-21** — Expo 앱 구조와 경로를 정리하고 온보딩 상태·안전한 로컬 스토리지를 구현했으며 EAS 빌드·제출 설정을 시작했습니다.<br>• **2026-05-22** — 앱 아이콘과 화면별 API 계획을 작성하고 KIS 실시간 체결가, 서명된 SSE 인증, 뉴스 수집, 종목마스터와 서버 Docker 구조를 구현했습니다. MCP·Codex 설정도 저장소에 추가했습니다.<br>• **2026-05-24** — AuthGate와 이메일·소셜 로그인을 만들고 관심종목·시그널·알림·뉴스·푸시·마이페이지를 실데이터에 연결했습니다. agent-browser 스킬과 Expo 폴더 규칙도 추가했습니다.<br>• **2026-05-25** — PR #1\~#3으로 develop 통합, EAS 의존성·작업 디렉터리 수정, Expo 환경 변수 인라인을 반영했습니다. Cloud Run과 스토어 제출·TestFlight 자동 배포를 구성했습니다.<br>• **2026-05-26** — Cloud Run 앞의 외부 ALB와 커스텀 도메인 설정을 문서화했습니다.<br>• **2026-05-27** — DiscussionRoom 도메인, oRPC 라우터, 방 생성, 목록과 채팅의 폴링·전송·삭제·퇴장 기능을 구현하고 worktree 분기 기준을 조정했습니다.<br>• **2026-05-28** — 가격 알림, 프로필, 문의, 약관, 종목 상세, 설정 화면을 API와 연결하고 준비 중 기능의 노출 범위를 정리했습니다.<br>• **2026-05-29** — PR #4\~#5로 develop을 반영하고 앱 소개 랜딩을 추가했습니다. KIS 토큰 DB 캐시, 스트림 인증과 공개 심볼 인증을 구현했습니다.<br>• **2026-06-01** — PR #6\~#8을 통해 뉴스 로그인 정책, 실시간 차트의 장외·주말 처리, 뉴스 분류와 UI 동작을 보완했습니다.<br>• **2026-06-02** — PR #9로 회사 소개 앱을 추가하고 시그널 관리, 관심종목·시그널 변경 시 실시간 pin 재동기화를 구현했습니다.<br>• **2026-06-08** — 공지 테이블, 내가 쓴 글·답글 API와 화면을 만들고 realtime·server 아키텍처 문서를 작성했습니다.<br>• **2026-06-09** — PR #10\~#13으로 SSE 백그라운드 복귀 시 좀비 연결을 제거하고 재연결했습니다. 웹 개인정보처리방침, 사전등록 저장·검증, Play Store 자산과 React 타입 충돌 수정도 반영했습니다.<br>• **2026-06-12** — 네이티브 시세·뉴스 상세·검색·가격 알림에 남아 있던 mock 값을 제거하고 실데이터만 표시하도록 검증했습니다.<br>• **2026-06-17** — PR #14\~#15로 stock_resource와 CDN 동기화 작업을 추가해 검색·관심종목·화면에서 종목 아이콘을 지원했습니다.<br>• **2026-06-18** — 가격 알림 평가와 사용자 알림을 구현하고 UI 컴포넌트를 재사용 가능한 단위로 분리했습니다.<br>• **2026-06-19** — PR #16\~#18로 푸시 알림의 뉴스 딥링크, OTA 업데이트와 앱 버전 1.0.1\~1.0.2를 반영했습니다.<br>• **2026-06-20** — PR #19\~#20으로 계정 삭제·로그아웃, 로그인 접근성, 동적 앱 버전 표기를 추가하고 1.0.3으로 올렸습니다.<br>• **2026-06-23** — PR #21로 한국어 locale과 다국어 기반을 추가하고 앱 버전을 1.0.4로 올렸습니다.<br>• **2026-06-24** — PR #22로 웹 랜딩의 앱 다운로드 CTA를 연결하고 Codex 설정을 갱신했습니다.<br>• **2026-07-21** — PR #23\~#25와 RFC 0001로 Naver 뉴스 API를 NCP API HUB에 맞추고 뉴스 분류·관련성·톤 개편을 설계했습니다.<br>• **2026-07-22** — PR #26으로 뉴스 개편, Gemini 배치 분류, 관리자 뉴스 작성·썸네일, 토론방 관리와 실시간 카운트를 통합했습니다.<br>• **2026-07-23** — 종목 검색 필터와 아이콘 노출을 보완하고 종목마스터 갱신 직후 아이콘을 델타 동기화하는 cron을 추가했습니다.<br>• **2026-07-24** — PR #27\~#28과 RFC 0004·0005·0008로 토론방 SSE, 검색·즐겨찾기, 첨부, 답글, 관리자 mute·차단·일괄 삭제를 구현했습니다.<br>• **2026-07-27** — PR #29\~#30과 RFC 0006으로 기본 뉴스 썸네일, 관리자 업로드, 독점·요약 칩을 구현했습니다.<br>• **2026-07-28** — PR #31\~#34와 RFC 0007로 시그널 추가·삭제 즉시 갱신과 알림을 고쳤고 랜딩을 관심종목→알림→뉴스→토론 흐름으로 재설계했습니다.<br>• **2026-07-29** — 시그널 알림 범위와 refresh 공통화를 정리하고 마이그레이션 순서, 토론 첨부·차단·SSE 정합성, 공용 바텀시트를 보완했습니다.<br>• **2026-07-31** — PR #35\~#38과 RFC 0009·0010으로 비로그인 접근·로그인 복귀·온보딩을 구현하고 머니게이트 회사 소개 사이트를 전면 재설계했습니다.<br>• **2026-08-03** — PR #39로 최종 develop 변경을 통합했습니다.
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
	## 개인 저장소와 전체 기여 근거
	- [Moneyroad-app — 코드·이력·브랜치·상세 문서](https://github.com/vscodereader/Moneyroad-app)
	- [전체 PR·개인 기여 색인](https://github.com/vscodereader/Moneyroad-app/blob/portfolio/portfolio/PR-INDEX.md)
	- [미커밋 작업과 변경 경로](https://github.com/vscodereader/Moneyroad-app/blob/portfolio/portfolio/WORK-IN-PROGRESS.md)
	- 환경 파일을 전체 이력에서 제외하고 원격 브랜치·로컬 브랜치·미커밋 스냅샷·과거 PR head를 보존함. 원본 해시 변경은 portfolio의 대응표에 기록함.
	- PR 본문·변경 파일·커밋·리뷰·대화 댓글은 개인 저장소에 보존함. 개인 작성 PR 9건을 아래에서 날짜별로 확인할 수 있음.
	<details>
	<summary>2026-07 개인 PR 전체</summary>
		- 2026-07-21 · **MERGED** · [#24 fix(realtime): 네이버 뉴스 검색 API NCP API HUB 통합 대응](https://github.com/beyondsoft-kr/moneyroad-app/pull/24)
		- 2026-07-22 · **MERGED** · [#26 feat: 뉴스 개편(RFC0001) + 관리자 뉴스 작성·썸네일(RFC0002) + 토론방 관리·실시간 카운트(RFC0003)](https://github.com/beyondsoft-kr/moneyroad-app/pull/26)
		- 2026-07-24 · **MERGED** · [#28 feat(discussion): 토론방 모더레이션·SSE·즐겨찾기/검색·첨부 (RFC 0004·0005) + 답글·내 글/답글 (RFC 0008)](https://github.com/beyondsoft-kr/moneyroad-app/pull/28)
		- 2026-07-27 · **MERGED** · [#30 feat(news): 뉴스 썸네일 기본 이미지 + 관리자 업로드 + 머니로드 독점 칩 (RFC 0006)](https://github.com/beyondsoft-kr/moneyroad-app/pull/30)
		- 2026-07-28 · **MERGED** · [#32 fix(signal): 시그널 문제 — 추가·삭제 시 화면 갱신 + 생성 시 알림 (RFC 0007)](https://github.com/beyondsoft-kr/moneyroad-app/pull/32)
		- 2026-07-28 · **MERGED** · [#34 feat(web): 랜딩 페이지 재디자인 — 관심종목→알림→뉴스→토론 흐름으로 재구성](https://github.com/beyondsoft-kr/moneyroad-app/pull/34)
		- 2026-07-31 · **MERGED** · [#37 feat(auth): 비로그인 접근 정책·로그인 복귀·계정 온보딩 구현 (RFC 0009)](https://github.com/beyondsoft-kr/moneyroad-app/pull/37)
		- 2026-07-31 · **MERGED** · [#38 feat(company): 머니게이트 회사 소개 웹사이트 전면 재설계 (RFC 0010)](https://github.com/beyondsoft-kr/moneyroad-app/pull/38)
	</details>
	<details>
	<summary>2026-08 개인 PR 전체</summary>
		- 2026-08-03 · **MERGED** · [#39 develop](https://github.com/beyondsoft-kr/moneyroad-app/pull/39)
	</details>
</details>
