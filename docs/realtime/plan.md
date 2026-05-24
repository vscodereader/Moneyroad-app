# Realtime 시세 서비스 — 작업 계획

종목 시세를 **SSE(단방향)**로 클라이언트에 푸시하는 서비스. API 서버
(`moneyroad-server`)와 분리된 별도 Cloud Run 서비스(`apps/realtime`).

- 코드: `apps/realtime/`
- 배포 런북: `apps/realtime/deploy/README.md`
- 전송: SSE (`text/event-stream`). 시세는 서버→클라 단방향이라 WebSocket 대신 채택.

---

## 현재 상태 (Phase 1 — 거의 완료)

- [x] 구조: `index.ts`(부트스트랩) / `server.ts`(buildServer) / `plugins/` / `services/`
      (apps/server와 동일 패턴)
- [x] SSE 엔드포인트 `GET /stream/quotes?symbols=...&token=...` — **`@fastify/sse`** 사용
      (하트비트·직렬화·Last-Event-ID 내장, async generator로 푸시 hub 브리지)
- [x] `GET /` , `GET /healthz`
- [x] `QuoteHub`: 클라↔종목 fan-out + 종목 ref-count(수요 기반 등록/해제)
- [x] `MarketDataFeed` 인터페이스 + `MockFeed`(랜덤워크, 자격증명 불필요)
- [x] **`KisFeed` 실연동** (KIS 공식 스펙) — 아래 "KIS 어댑터" 참고
- [x] **인증 게이트** (서명 스트림 토큰) — 아래 "인증" 참고
- [x] env를 `@moneyroad-app/env/realtime`로 이관
- [x] **evlog** 구조화 로깅(일반 라우트 wide event + SSE 세션 open/close + KIS 연결 로깅)
- [x] Dockerfile(멀티스테이지) + cloudbuild `_DOCKERFILE` 파라미터화
- [x] 로컬/컨테이너 e2e 검증 (mock + KIS 핸드셰이크)

> 아직 **Cloud Run에 배포하지 않음** (always-on 비용 때문에 보류).
> 남은 라이브 검증: **장중 실시간 틱 수신**(평일 09:00~15:30 KST).

---

## 아키텍처

**Phase 1 (현재): 단일 인스턴스, Redis 불필요**
```
            ① POST /stream-token (세션 검증 → 단기 서명 토큰)
[앱/웹] ──────────────────────────────────────────────→ [server]
   │  ② SSE ?token=<서명토큰>
   └──────────────────→ [realtime (min=max=1, CPU 상시)] --1연결--> [KIS 실시간]
                          (토큰 서명·만료 검증, DB 불필요)
```
한 프로세스가 KIS 1연결 + 클라 fan-out을 모두 처리(메모리 공유).

## 인증 (완료)

별도 도메인 SSE 서비스라 웹 `EventSource`는 헤더를 못 보내고 세션 쿠키도
크로스도메인이라 안 붙는다. → **서명 스트림 토큰**을 쿼리로 전달하는 방식 채택.

- `@moneyroad-app/stream-token`: HMAC 서명/검증 공유 패키지(node:crypto, deps 없음)
- server `POST /stream-token`: better-auth 세션 검증(`auth.api.getSession`) 후
  단기(120s) 서명 토큰 발급. 미인증 시 401
- realtime `/stream/quotes?token=`: 서명·만료만 검증(DB·auth 의존 없이 린 유지),
  실패 시 401
- 공유 시크릿 `STREAM_TOKEN_SECRET`(양쪽 env, ≥32자)
- ⚠️ 클라 재연결: 토큰 만료 시 새 토큰 발급 후 재연결 필요. 웹 `EventSource`는
  자동 재연결이 URL을 재사용하므로, 클라에서 onerror 시 토큰 재발급+재생성 래핑 권장

**Phase 2 (스케일): Ingestion 분리 + Redis 백플레인**
```
[KIS] --1연결--> [Ingestion(min=max=1)] --pub--> [Memorystore Redis] --sub--> [SSE 서버 1..N] --> 앱/웹
```

---

## KIS 어댑터 (완료) — `apps/realtime/src/services/feed/kis.ts`

KIS 공식 예제(`ccnl_krx`, `auth_ws_token`, `kis_auth`) 스펙으로 구현.

- [x] 실시간 체결가 `H0STCNT0` TR, WS URL `…:21000(실전)/31000(모의)/tryitout`
- [x] `parseTradeFrames` 필드 매핑 (현재가 2 / 부호 3 / 전일대비 4 / 등락률 5 /
      누적거래량 13, 부호 적용) — 순수 함수로 추출, 합성 프레임 10/10 통과
- [x] 다건 프레임 처리 (레코드당 46필드 페이징)
- [x] PINGPONG echo (Node 글로벌 WebSocket은 pong() 미노출 → 텍스트 프레임 echo)
- [x] 암호화: 체결가는 평문(`0`)만 처리, 암호화 프레임(`1`) 무시 → 복호화 불필요
- [x] close 시 지수 백오프(1s~30s) 재연결 + 재구독
- [x] 종목 수 제한(40) 가드
- [x] `Quote`에 change/changeRate/volume 채움
- [x] 라이브 검증: paper 키로 approval + WS 연결 + `SUBSCRIBE SUCCESS` 확인
- [ ] **실시간 틱 수신 라이브 검증** (장중 09:00~15:30 KST — 마지막 남은 항목)
- [ ] (선택) approval_key 만료(24h) 갱신 — 현재는 재연결 시 기존 키 재사용
- [ ] (선택) 호가(`H0STASP0`) 등 추가 TR

### 클라이언트 연동 (남음)
- [ ] **앱(React Native)**: `react-native-sse` 폴리필로 `EventSource` 사용
      (RN엔 내장 EventSource 없음). 페이지 진입 시 종목으로 스트림 오픈, 이탈 시 닫기
- [ ] **웹(Next.js)**: 브라우저 내장 `EventSource` 사용
- [ ] 재연결 전략(브라우저 자동 재연결 + `Last-Event-ID` 활용 검토)
- [ ] 종목 변경 UX: per-page 스트림 재오픈 방식 (현재 설계)

### 배포 (Cloud Run, 남음) — `apps/realtime/deploy/README.md`
- [ ] Artifact Registry 빌드: `cloudbuild.yaml` + `_DOCKERFILE=apps/realtime/Dockerfile`
- [ ] 시크릿: `stream-token-secret`(server와 동일), (KIS 시) `kis-app-key`/`kis-app-secret`
- [ ] `gcloud run deploy moneyroad-realtime` — **필수 플래그**:
      `--no-cpu-throttling --min-instances=1 --max-instances=1 --timeout=3600 --concurrency=250 --port=8080`
      `--set-secrets=STREAM_TOKEN_SECRET=stream-token-secret:latest`
- [ ] mock 피드로 먼저 배포해 SSE 동작 확인 → `FEED=kis`로 전환

### Phase 2 — 스케일 (동시접속 증가 시)
- [ ] Ingestion 프로세스 분리 (KIS 1연결 전담, min=max=1)
- [ ] Memorystore(Redis) pub/sub 백플레인 (`tick:{종목}` 채널)
- [ ] SSE 서버는 Redis 구독 + 클라 fan-out (수평 확장)
- [ ] 종목 수요 집계(ref-count)를 Redis 기반으로 이전

---

## 뉴스 수집 (신규) — `apps/realtime/src/services/news/`

레거시 `apps/server`의 네이버 뉴스 수집기를 개선해 realtime으로 이관했다.
realtime은 `min=max=1 + no-cpu-throttling`로 **항상 켜져 있는** 유일한 서비스라
주기 스케줄러(폴링)에 적합하다(API 서버는 scale-to-zero라 타이머 불가).

수집기는 **DATABASE_URL + 네이버 키가 있을 때만** 구동되며, 없으면 realtime은
기존처럼 순수 시세(quotes) 피드로만 동작한다(`isCollectorEnabled()` 가드).

### 파이프라인 (`collector.ts`)
1. 활성 `news_subscription` query 수집 (없으면 기본 `"주식"`)
2. 네이버 검색 API로 목록 fetch (`naver.ts`, `sort=date`)
3. **중복 선필터** — 배치의 `originallink`를 DB와 대조해 **신규만** 남김
   (개선①: 레거시는 매 기사 무조건 크롤 → 신규만 크롤로 부하 대폭 감소)
4. 신규 항목만 동시성 제한(5)으로 처리:
   - 본문 크롤 + 언론사 추출 (`crawlNaverArticle`)
   - **종목 자동 매칭** (`stock-matcher.ts`, 개선②) — `stock_master` 종목명을
     메모리 인덱스(최장 일치 우선)로 로드해 제목/본문에서 `stockCode` 추출
   - **AI 요약/분류** (`ai.ts`, 개선③) — `@ai-sdk/google` `generateObject`로
     `summary`(신규 컬럼) + `category` 생성. 키 없으면 query 휴리스틱으로 폴백
5. `onConflictDoNothing(originallink)`로 insert → 적재분만 returning
6. 적재분을 NewsHub로 broadcast(SSE) + `notifyBreakingNews`(속보 푸시) 트리거

### 엔드포인트 (`plugins/news.ts`)
- `GET /api/news?limit=&category=&stockCode=` — 저장 뉴스 조회(REST, 인증 불필요)
- `GET /stream/news?symbols=&categories=&token=` — 신규 뉴스 SSE(`event: news`).
  토큰 인증은 `/stream/quotes`와 동일(서명 스트림 토큰). symbols·categories를
  모두 비우면 전체 신규 뉴스를 받음
- `GET /healthz/news` — `{ status, clients }`

### 속보 푸시 (`push.ts` + `expo-push.ts`) — 서버측 구현 완료
- `news` 워치리스트 구독자 중 `breakingNews` 설정 ON 사용자에게 Expo 푸시
- 키워드 휴리스틱(속보/급등/급락 등)으로 속보 판정, `stockCode` 있는 뉴스만 타겟
- 피로도 쿨다운(5분 내 동일 user·type 상한) + `notification_history` 추적
- ⚠️ **단말 등록/실발송은 미완** — 아래 "다음 단계 — 푸시 알림" 참고

### 종목마스터 로더 (`services/stock-master/`)
종목 매칭·속보 푸시가 동작하려면 `stock_master` 적재가 선행돼야 한다. KIS 공식
종목마스터(.mst)를 받아 적재하는 로더를 구현했다.
- KIS 공식 다운로드(`kospi_code.mst.zip`/`kosdaq_code.mst.zip`, KIS 키 불필요)
  → unzip(`adm-zip`) → CP949 디코딩(`iconv-lite`) → 고정폭 파싱 → **upsert**
  (replace 아님 — news/watchlist FK 보존)
- 파싱 스펙은 KIS 공식 파이썬 예제(`kis_kospi/kosdaq_code_mst.py`) 기준
  (`spec.ts`의 `KOSPI_FIELDS`/`KOSDAQ_FIELDS`, 79개 컬럼 매핑)
- 수동 실행: `pnpm --filter realtime load:stock-master` (DATABASE_URL만 필요)
- **자동 갱신 (`plugins/scheduler.ts`)**: `@fastify/schedule` + `toad-scheduler`
  CronJob으로 매일 `STOCK_MASTER_CRON`(기본 `0 6 * * *`, `STOCK_MASTER_TZ`
  기본 `Asia/Seoul`)에 `loadStockMaster()` 실행. DATABASE_URL 없으면 no-op
- **부트스트랩**: 기동 시 stock_master가 비어 있으면 1회 자동 적재(신규 배포 대응)
- 검증됨: KOSPI 2533 + KOSDAQ 1824종목, 삼성전자/SK하이닉스/현대차/에코프로 등
  종목명·표준코드·상장일 정확

### 다음 단계 — 푸시 알림 (보류)
서버측 발송 로직(`expo-push.ts`/`push.ts`)·쿨다운·`notification_history` 추적은
구현 완료. 실제 단말까지 보내려면 아래가 남았다.

- [ ] **native 푸시 토큰 등록** (현재 `expo-notifications` 미설치)
  - `expo-notifications` 설치 + 알림 권한 요청
  - `getExpoPushTokenAsync()`로 토큰 발급 → 서버 라우트로 전송해 `user_push_token`에 저장
    (저장 라우트는 server 또는 realtime 어디에 둘지 결정 필요)
- [ ] **워치리스트(type='news') + 알림설정 UI** — 구독자/ON 사용자가 있어야 타겟 발생
- [ ] 실발송 검증

**테스트 제약 (조사 완료, SDK 55 기준)**
- 원격 푸시는 **시뮬레이터·Expo Go에서 불가** → **development build + 실기기** 필요
  (iOS 시뮬레이터는 Expo push token 발급 불가, Expo Go는 SDK 53부터 원격 푸시 제거)
- Android 에뮬레이터(Google Play 포함) + dev build + FCM 설정은 가능
- 로컬 알림은 시뮬레이터에서도 되지만 서버 발송 경로를 안 거쳐 검증 의미 없음
- 서버 발송 경로만 빠르게 검증하려면: 실기기/Expo 도구로 받은 **실제 토큰 1개**를
  `user_push_token`에 수동 INSERT → `notifyBreakingNews` 트리거 →
  `notification_history.delivery_status`/`ticket_id`로 발송·티켓 추적 확인

### ⚠️ 기타 남은 의존성
- realtime 배포에 **DATABASE_URL** + (네이버/AI) 시크릿 추가 필요 (아래 배포 참고)
- 마이그레이션 적용(`pnpm db:migrate`) 후 `load:stock-master` 1회 실행 필요
  (또는 부트스트랩이 빈 테이블 시 자동 적재)
- AI 요약 사용 시 **실제 `GOOGLE_GENERATIVE_AI_API_KEY`** 필요 (현재 빈 값 → 휴리스틱 폴백)

### 추가된 스키마/패키지
- DB: `news`(+`summary`), `news_subscription`, `stock_master`, `user_watchlist`,
  `user_notification_setting`, `user_push_token`, `notification_history`
  (마이그레이션 `0001_*.sql` 생성됨)
- `@moneyroad-app/db/client` 분리 — env/server 검증 없이 `createDb(url)` 사용
  (realtime이 `env/realtime.DATABASE_URL`로 자체 연결)
- realtime deps: `drizzle-orm`, `pg`, `expo-server-sdk`, `ai`, `@ai-sdk/google`,
  `adm-zip`, `iconv-lite` (종목마스터 로더)

---

## 시그널 엔진 (신규) — 계획

기술적 시그널을 산출해 `signal` 테이블에 적재하는 엔진. realtime에 둔다(항상
켜져 있어 크론에 적합 — 뉴스 수집기·종목마스터 로더와 동일 이유). 화면/oRPC
**기반은 이미 구현**됐고(커밋 `2d057ef`, [signals.md](../native/api/signals.md))
**엔진(생성기)만 남았다** → 현재 `signal` 테이블은 비어 있어 화면은 빈 상태.

### 결정된 설계 (사용자 확인)
- **모델**: 액션 기반(매수/매도/관망). 소스는 `tech`만 생성(나머지 향후).
- **유니버스**: 모든 유저 `user_watchlist` 종목 **합집합**만 스캔.
- **활성 시그널**: 로그인 유저 관심종목의 최근 24h 시그널 수(`signal.activeCount` 구현됨).

### 파이프라인 (예정 — `services/signal/`)
1. 유니버스 수집: `selectDistinct(stockCode) from user_watchlist`
2. **KIS REST 클라이언트** (신설): `/oauth2/tokenP` 액세스 토큰 발급/갱신
   (WS approval_key와 별개), 일봉 `inquire_daily_itemchartprice` 호출 래퍼,
   레이트리밋·에러 정규화
3. 종목별 일봉 → 지표 계산: 골든크로스(MA), RSI, 거래량 급증
4. 지표 → **매수/매도/관망** 분류 + `strength`(1~5) + `title`/`body` 생성,
   근거를 `indicators`(jsonb)에 저장
5. `signal` 테이블 upsert (중복/쿨다운 정책 적용)
6. (선택) 신규 시그널 → `notification_history` + Expo 푸시(뉴스 속보 경로 재사용)

### 작업 체크리스트
- [ ] **KIS REST 클라이언트** (`services/kis-rest.ts`): 토큰 캐시/갱신 + 일봉 조회.
      (native API plan.md의 "공통 인프라"와 공유 가능 — 위치 결정 필요)
- [ ] 지표 계산 순수 함수(MA/RSI/volume) + 단위 테스트(합성 일봉)
- [ ] 분류기: 지표 → action/strength/title/body, 임계값 상수화
- [ ] `services/signal/collector.ts`: 유니버스 순회 + 동시성 제한 + upsert
- [ ] `plugins/scheduler.ts`에 시그널 크론 추가 (주기/장중 한정 결정)
- [ ] (선택) 시그널 푸시 연동(알림설정 ON·`buy_signal`/`sell_signal` 타입)
- [ ] env 추가: 시그널 크론/주기, 지표 임계값(필요 시)

### 미정 / 결정 필요
- [ ] 실행 주기(장중 N분 vs 장마감 후 1회)와 중복 시그널 쿨다운.
- [ ] 시그널 푸시 연동 여부.
- [ ] RSI 경계·거래량 배수 등 임계값, `strength` 산출 공식.

---

## 참고

### Cloud Run 필수 설정 (시세 서비스)
| 설정 | 값 | 이유 |
|---|---|---|
| `--no-cpu-throttling` | CPU 상시 할당 | 백그라운드 KIS 수신·push 루프 유지 |
| `--min-instances=1 --max-instances=1` | 단일 인스턴스 | KIS 1연결 보장 (Phase 1) |
| `--timeout=3600` | 60분 | SSE 최대 연결 시간 → 클라 자동 재연결 |
| `--concurrency=250` | 높게 | SSE 연결은 대부분 idle |

### 환경변수 (`@moneyroad-app/env/realtime`)
- `FEED` = `mock` | `kis`
- `PORT`(Cloud Run 자동), `HEARTBEAT_MS`, `MOCK_INTERVAL_MS`
- `STREAM_TOKEN_SECRET` (server와 동일, ≥32자)
- `KIS_ENV` = `prod` | `paper`, `KIS_APP_KEY`, `KIS_APP_SECRET`
- (뉴스) `DATABASE_URL`, `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` — 셋 다 있어야 수집 구동
- (뉴스) `NEWS_FETCH_INTERVAL_MS`(기본 60000), `NOTIFICATION_COOLDOWN_5M_MAX`(기본 5)
- (뉴스 AI, 선택) `GOOGLE_GENERATIVE_AI_API_KEY`, `NEWS_AI_MODEL`(기본 `gemini-2.5-flash`)
- (종목마스터 갱신) `STOCK_MASTER_CRON`(기본 `0 6 * * *`), `STOCK_MASTER_TZ`(기본 `Asia/Seoul`)

### 엔드포인트
- realtime `GET /stream/quotes?symbols=005930,000660&token=<서명토큰>` → `event: quote` 스트림 (토큰 없으면 401, Accept 미협상 시 406)
- realtime `GET /stream/news?symbols=&categories=&token=<서명토큰>` → `event: news` 스트림 (필터 비우면 전체 신규)
- realtime `GET /api/news?limit=&category=&stockCode=` → `{ items }` (저장 뉴스 조회, 인증 불필요)
- realtime `GET /healthz` → `{ status, clients }`, `GET /healthz/news` → `{ status, clients }`
- server `POST /stream-token` → `{ token, expiresIn }` (로그인 세션 필요, 미인증 401)
