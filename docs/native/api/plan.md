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
- [ ] 도메인 라우터: **`healthCheck`/`todo`만 존재** → 전부 신규
- [ ] KIS **REST** 클라이언트(서버측): 현재 `apps/realtime`엔 WS 어댑터만 있음
- [ ] 모든 화면이 mock import 중

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

### Phase 2 — 사용자 데이터 (🔵 DB, 🔑 Auth)
관심종목·알림·프로필. Phase 1 시세와 결합해 홈④·마이 완성.
- [ ] `watchlist.list` / `add` / `remove` / `preview({ limit })`
      (목록은 DB, 시세·spark는 Phase 1 결합, score는 Phase 4 전까지 placeholder)
- [ ] `notifications.list` / `unreadCount` / `markRead`
- [ ] `user.me` / `user.stats`
- [ ] `settings.get` / `settings.update`

### Phase 3 — 콘텐츠: 뉴스 (🟣 AI + 외부 + 🔵 DB)
- [ ] 뉴스 수집 파이프라인(외부 소스 → 종목/카테고리/감성 태깅 → DB)
- [ ] AI 요약 생성(LLM, 사전배치 vs 온디맨드 결정)
- [ ] `news.feed({ tab, cursor })` / `news.detail({ id })`

### Phase 4 — 콘텐츠: 토론 (🔵 DB, 🔑 Auth)
- [ ] `discuss.threads` / `toggleLike` / `createThread`
- [ ] `discuss.thread` / `messages` / `sendMessage`
- [ ] (⚡) `discuss.stream` 실시간 채팅 — realtime SSE 재사용 검토

### Phase 5 — 시그널 엔진 (⚙️)
가장 복잡, 차트·뉴스·토론 데이터에 의존.
- [ ] `tech`: Phase 1 일봉으로 골든크로스·RSI·거래량 계산
- [ ] `community`: Phase 4 토론량·감성 집계
- [ ] `event`: 공시/뉴스 파이프라인
- [ ] `ai`: 자체 예측 모델
- [ ] `signals.feed({ type, window, cursor })` / `signals.counts`
- [ ] `score` / `signalBreakdown` 산출 → 홈④·종목상세 backfill

### Phase 6 — 실시간 전환 (⚡ RT)
- [ ] 관심종목 현재가를 폴링 → SSE 구독으로 전환(`apps/realtime` 연동)
- [ ] 채팅 실시간 수신 안정화

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

## 미해결 결정사항 (전역)

- [ ] 공유 스키마 위치: `packages/api` 내부 vs 신규 `packages/contracts`.
- [ ] KIS REST를 `apps/server`에 둘지, `apps/realtime`과 공유 패키지로 뺄지.
- [ ] 뉴스 원천 소스/라이선스, AI 요약 생성 시점(배치 vs 온디맨드).
- [ ] 시그널 엔진 실행 형태(배치 잡 vs 온디맨드)와 저장(`signal` 캐시).
- [ ] 실시간 범위: 시세만 vs 채팅 포함, SSE 재사용 vs 분리.
- [ ] 페이지네이션 표준(커서 형식)·에러 코드 규약.

> 각 화면의 세부 미정 항목은 해당 문서의 "미정/결정 필요" 절 참고.
