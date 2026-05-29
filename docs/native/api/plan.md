# 네이티브 API — 구현 계획

[화면별 필요 API 문서](./README.md)에서 도출한 엔드포인트를 실제 oRPC 라우터로
구현하기 위한 작업 계획. 목표는 `apps/native`의 mock(`@/utils/data.ts`)을
서버 데이터로 단계적으로 대체하는 것.

- 대상 화면: 홈 / 시그널 / 뉴스 / 토론 / 마이 ([각 문서](./README.md#화면별-문서))
- API 코드: `packages/api/src/routers/<domain>.ts`
- DB: `packages/db/src/schema/<name>.ts` (PostgreSQL + Drizzle)

---

## 현재 상태

- [x] oRPC 토대: `publicProcedure` / `protectedProcedure`(requireAuth 미들웨어),
      Zod input, better-auth 세션 컨텍스트 (`packages/api/src/index.ts`)
- [x] DB 토대: Drizzle + node-postgres, `schema/index.ts` re-export 패턴
- [x] 실시간 시세 인프라: `apps/realtime` SSE(허브·인증 토큰·KIS WS 어댑터)
- [x] 도메인 라우터: `news` / `notification` / `signal` / `stock` / `watchlist` /
      `discussion` (+ `healthCheck`/`todo`). 남은 도메인: `market`(시세)
- [x] 인증: 이메일 + 소셜(구글/애플/네이버/카카오) 로그인, 로그인 화면, mypage 게이트
- [ ] KIS **REST** 클라이언트(서버측): 현재 `apps/realtime`엔 WS 어댑터만 있음
      → 시세(market) + 시그널 엔진 양쪽에서 필요
- [ ] 화면 mock 잔존: 시세(지수·현재가·차트), 종목 카드(price/score), 차트

---

## 설계 원칙

### 1. 타입은 서버가 단일 소스 (oRPC 타입 추론)

native는 이미 `AppRouterClient`(`RouterClient<typeof appRouter>`)로 서버 타입을
추론한다(`apps/native/src/utils/orpc.ts`). 따라서 **서버 라우터에서 Zod로
응답 스키마를 정의하면 native는 자동으로 그 타입을 받는다.** 현재
`@/utils/data.ts`의 수동 인터페이스(`Stock`/`Signal`/`NewsItem`/`Thread`/
`ChatMessage`/`Notification`/`MarketIndex`)는 서버 스키마로 이관하고, native는
mock 상수만 제거하면 된다.

> 권장: 공유 Zod 스키마를 `packages/api`(또는 신규 `packages/contracts`)에 두고
> 라우터 input/output과 DB insert 타입에 재사용.

### 2. 레이어 분리

라우터는 얇게 두고 로직은 서비스로 뺀다(`apps/server` 또는 `packages/api`).

```
oRPC 라우터 (입력검증·인증)
   └── 서비스: market / watchlist / news / discuss / signals / user
          ├── KisRest  (🟢 시세 — 토큰·캐시·레이트리밋)
          ├── Drizzle  (🔵 DB)
          ├── Ai       (🟣 요약·예측)
          └── realtime (⚡ SSE 브리지)
```

### 3. 캐시 / 갱신

- 시세성(현재가·지수)은 서버 단기 캐시(수 초) + native `staleTime` 짧게.
- 차트(일봉)는 일 1회 캐시. 정적/콘텐츠는 길게.
- 실시간이 필요한 화면(관심종목 시세·채팅)은 ⚡RT(SSE) 구독.

---

## 신설 DB 스키마

| 테이블 | 용도 | 핵심 컬럼 | 화면 |
|---|---|---|---|
| `watchlist` | 사용자 관심종목 | `userId, code, createdAt` | 홈④·마이 |
| `notification` | 알림함 | `userId, type, title, body, code, section, read, createdAt` | 홈헤더·마이·알림 |
| `userSettings` | 알림/표시 설정 | `userId, signalAlert, newsAlert, priceAlert, display(json)` | 마이·설정 |
| `news` | 뉴스 + AI요약 | `id, code, category, title, source, url, sentiment, ai, publishedAt` | 홈③·뉴스 |
| `thread` | 토론 스레드 | `id, code, authorId, title, body, sentiment, likes, members, createdAt` | 토론 |
| `threadMessage` | 채팅 메시지 | `id, threadId, authorId, text, sentiment, createdAt` | 채팅방 |
| `threadLike` | 좋아요 | `userId, threadId` (복합 PK) | 토론 |
| `signal` | 엔진 산출 캐시 | `id, code, type, strength, title, body, createdAt` | 홈②·시그널 |

> 시세(지수·현재가·차트)는 **DB 불필요** — KIS 패스스루 + 단기 캐시.
> `user`는 better-auth 스키마(`schema/auth.ts`) 재사용.

---

## 공통 인프라 (선행 작업)

- [ ] **KIS REST 클라이언트**: OAuth 토큰 발급/갱신, `inquire_*` 호출 래퍼,
      레이트리밋·에러 정규화. (realtime의 approval_key 로직 참고, REST는 신설.)
- [ ] **공유 Zod 스키마/타입**: native data.ts 인터페이스 이관.
- [ ] **서비스 레이어 스캐폴딩** + 라우터 등록 패턴(`routers/index.ts`).

---

## Phase 로드맵

의존성과 검증 난이도 순. 각 Phase는 독립 배포 가능 단위.

### Phase 1 — 시세 읽기 (🟢 KIS, DB 불필요) ⭐ 먼저
가장 독립적이고 검증이 쉬우며, 홈 지수/관심종목 시세에 즉시 효과.
- [ ] `market.indices` → `MarketIndex[]` (KIS `inquire_index_price`)
- [ ] `market.quote({ code })` / `market.quotes({ codes })` (KIS `inquire_price`)
- [ ] `market.chart({ code, period, count })` (KIS `inquire_daily_itemchartprice`)
- 검증: 장중 실제 시세 일치, 캐시 동작. `publicProcedure` 가능.

### Phase 2 — 사용자 데이터 (🔵 DB, 🔑 Auth) — 대부분 완료
관심종목·알림·프로필. Phase 1 시세와 결합해 홈④·마이 완성.
- [x] `watchlist.list` / `add` / `remove` (검색 추가·관심종목 화면 연결)
      — 시세·spark는 미연동(Phase 1 대기), score는 Phase 5 전까지 placeholder
- [x] `notification.unreadCount` / `history` / `markRead` / `markAllRead`
      (알림함 화면 실데이터 + mypage 배지·스탯)
- [x] `notification.getSettings` / `updateSettings` (알림설정 DB 저장, hold 포함)
- [x] `notification.registerPushToken` / `unregisterPushToken` (단말 토큰 등록)
- [x] mypage 프로필(세션) + 로그아웃 + 스탯(관심종목·활성시그널·안읽은알림) 실데이터
- [ ] `watchlist`에 시세·spark 결합 (Phase 1 필요)
- [ ] `user.me` / `user.stats` (현재 세션·개별 쿼리로 대체 중)

### Phase 3 — 콘텐츠: 뉴스 (🟣 AI + 외부 + 🔵 DB) — 완료
- [x] 뉴스 수집 파이프라인 (realtime 네이버 수집 + 종목 매칭 + AI 요약/분류)
      — [realtime/plan.md](../../realtime/plan.md#뉴스-수집-신규)
- [x] AI 요약 생성 (`@ai-sdk/google`, 키 없으면 휴리스틱 폴백)
- [x] `news.feed({ tab, cursor, limit })` / `news.detail({ id })` (화면 연결 + SSE 라이브 갱신)
- [ ] 웹(Next.js) 뉴스 화면 연동 (앱만 완료)

### Phase 4 — 콘텐츠: 토론 (🔵 DB, 🔑 Auth) — 완료
**DiscussionRoom 모델**로 통일: 스레드/메시지 2계층이 아닌 **종목 바인딩 채팅방**.
종목 연결은 선택([ADR 0003](../../adr/0003-discussion-room-stock-binding.md),
`stock_code` nullable), 멤버십은 첫 전송 시 암묵 등록([ADR 0002](../../adr/0002-implicit-membership.md)).
- [x] `discussion.rooms({ tab })` / `room({ id })` / `toggleLike` (목록·상세·좋아요)
- [x] `discussion.messages` / `send` / `deleteMessage`(soft delete) / `leaveRoom` (채팅)
- [x] 화면 연결: 토론 목록(`screens/discuss`) · 채팅방(`screens/discussion-room`) ·
      방 생성 admin(`screens/discussion-room-new`)
- [x] DB: `discussion_room` / `discussion_message` / `discussion_room_member` /
      `discussion_room_like`
- [x] 실시간 채팅: **폴링 우선**(`refetchInterval: 5000`,
      [ADR 0001](../../adr/0001-polling-first-ws-later.md)). WS/SSE 전환은 Phase 6

### Phase 5 — 시그널 (⚙️) — 기반 완료, 엔진 남음
**모델 전환**: 소스 기반 → **액션 기반(매수/매도/관망)**. 소스(`tech` 등)는 부가 필드.
- [x] DB `signal` 테이블(action/source/strength/title/body/indicators) + 0003
- [x] `signal.feed({ action?, code?, window, cursor?, limit })` / `signal.counts` /
      `signal.activeCount`(protected, 내 관심종목 24h)
- [x] 화면 연결: 시그널 화면(필터+무한스크롤)·home·mypage 스탯·stock-detail
- [ ] **⚙️ 시그널 엔진(생성기)**: KIS 일봉 → 골든크로스/RSI/거래량 → 액션/strength 산출
      → `signal` 적재. realtime에 구현. 유니버스=관심종목 합집합.
      **체크리스트: [realtime/plan.md](../../realtime/plan.md#시그널-엔진-신규)**
- [ ] `community`(토론 집계)·`event`(공시)·`ai`(예측) 소스 — 향후
- [ ] `score` / `signalBreakdown` 산출 → 홈④·종목상세 backfill

### Phase 6 — 실시간 전환 (⚡ RT)
- [ ] 관심종목 현재가를 폴링 → SSE 구독으로 전환(`apps/realtime` 연동)
- [ ] 토론 채팅 폴링(`refetchInterval: 5000`) → WS/SSE 전환 (ADR 0001, PMF 검증 후)

---

## 화면별 완료 조건 (mock 제거 기준)

| 화면 | 필요 Phase |
|---|---|
| 홈 | 1(지수) + 2(관심종목·알림) + 3(뉴스) + 5(시그널) |
| 시그널 | 5 (+ 1 차트) |
| 뉴스 | 3 (+ 1 종목 스냅샷) |
| 토론 | 4 (+ 1 종목 스냅샷) |
| 마이 | 2 |

> 홈은 여러 Phase에 걸쳐 섹션별로 점진 전환(지수→관심종목→뉴스→시그널).

---

## 남은 작업 백로그 (다음 라운드 후보)

진행 중 수시로 선택하는 항목. 우선순위는 협의로 조정.

| 작업 | 효과 / 비고 | 참고 |
|---|---|---|
| ⚙️ **시그널 엔진** | `signal` 테이블 채움 → 시그널 화면·home·mypage 활성화 | [realtime/plan.md](../../realtime/plan.md#시그널-엔진-신규) |
| 🟢 **시세(market) 라우터 + KIS REST** | 홈 지수·관심종목 시세·종목상세 차트 실데이터화 | plan Phase 1, "공통 인프라" |
| 관심종목 시세·spark 결합 | `watchlist.list`에 현재가/스파크 추가 | Phase 1 의존 |
| ~~로그인 라우트 게이트 정리~~ ✅ | `AuthGate` 컴포넌트로 watchlist/alerts/settings/mypage 보호 | `components/auth-gate.tsx` |
| 실기기 푸시 발송 검증 | dev build + 실기기에서 속보/시그널 푸시 e2e | [realtime/plan.md](../../realtime/plan.md#다음-단계--푸시-알림-보류) |
| 웹 뉴스 화면 연동 | `apps/web` 뉴스 페이지(앱만 완료) | Phase 3 |
| ~~토론(discuss) 도메인~~ ✅ | DiscussionRoom 채팅방·좋아요·폴링 채팅 (Phase 4 완료) | `routers/discussion.ts` |
| realtime 시세 SSE 클라 연동 + 배포 | 관심종목 실시간 시세, Cloud Run 배포 | [realtime/plan.md](../../realtime/plan.md) |

---

## 미해결 결정사항 (전역)

- [ ] 공유 스키마 위치: `packages/api` 내부 vs 신규 `packages/contracts`.
- [ ] KIS REST를 `apps/server`에 둘지, `apps/realtime`과 공유 패키지로 뺄지.
- [ ] 뉴스 원천 소스/라이선스, AI 요약 생성 시점(배치 vs 온디맨드).
- [ ] 시그널 엔진 실행 형태(배치 잡 vs 온디맨드)와 저장(`signal` 캐시).
- [ ] 실시간 범위: 시세만 vs 채팅 포함, SSE 재사용 vs 분리.
- [ ] 페이지네이션 표준(커서 형식)·에러 코드 규약.

> 각 화면의 세부 미정 항목은 해당 문서의 "미정/결정 필요" 절 참고.
