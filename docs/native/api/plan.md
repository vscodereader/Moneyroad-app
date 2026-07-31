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
<!-- vscodereader 2026-07-30 수정: 기존 미구현이었던 KIS REST·native 시세 연결이
realtime 서비스의 REST/SSE 경로로 구현되어 현재 상태를 분리해 기록. -->
- [x] KIS **REST** 클라이언트: `apps/realtime/src/services/index-intraday.ts`의
      OAuth 토큰 발급·영속화와 `stock-price.ts`/`stock-chart.ts`의 현재가·차트 조회
- [x] 지수·현재가·차트·sparkline·관심종목 시세를 realtime REST/SSE로 앱에 연결
- [ ] `market.*` oRPC 라우터는 없음. 현재 구조에서는 realtime 경로가 이 역할을 대체
- [ ] mock 잔존: 정적 검색·일부 종목 메타데이터·타입. 시세성 숫자는 실데이터 또는
      연결 중/데이터 없음 상태를 사용

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

<!-- vscodereader 2026-07-30 수정: 설계 당시의 watchlist/thread/userSettings
가상 테이블명을 실제 생성된 snake_case 스키마와 첨부·모더레이션 테이블로 교체. -->
| 테이블 | 용도 | 핵심 컬럼 | 화면 |
|---|---|---|---|
| `user_watchlist` | 사용자 관심종목·구독 종류 | `userId, stockCode, type, createdAt` | 홈④·관심종목·알림 |
| `notification_history` | 인앱·푸시 알림 이력 | `userId, type, title, body, readAt, createdAt` | 홈헤더·마이·알림 |
| `user_notification_setting` | 시그널·뉴스·가격 알림 설정 | `userId, buySignal, sellSignal, holdSignal, breakingNews, disclosure, priceAlert` | 마이·설정 |
| `user_push_token` | Expo Push Token | `userId, token, platform, active` | 푸시 |
| `user_price_alert` | 종목 목표가 알림 | `userId, stockCode, targetPrice, direction, active` | 가격 알림 |
| `news` | 뉴스 + 머니로드 요약 | `id, stockCode, category, title, summary, url, publishedAt` | 홈③·뉴스 |
| `discussion_room` | 토론방 | `id, name, description, stockCode, sentiment, createdBy` | 토론 |
| `discussion_message` | 텍스트·이미지·파일·답글·가림/삭제 상태 | `roomId, userId, type, content, parentId, deletedAt, blindedAt` | 채팅방 |
| `discussion_room_member/block/like/favorite` | 멤버십·차단·좋아요·즐겨찾기 | 사용자·방 복합키와 상태 시각 | 토론 |
| `moneyroad_image` / `discussion_message_image` | 공용 이미지 메타데이터·메시지 이미지 순서 | 버킷 키, MIME, 크기, `sortOrder` | 채팅 이미지 |
| `discussion_file_attachment` | 메시지당 단일 파일 업로드 | 버킷 키, MIME, 크기, 파일명, `messageId` | 채팅 파일 |
| `signal` | 엔진 산출 캐시 | `id, code, type, strength, title, body, createdAt` | 홈②·시그널 |

> 시세(지수·현재가·차트)는 **DB 불필요** — KIS 패스스루 + 단기 캐시.
> `user`는 better-auth 스키마(`schema/auth.ts`) 재사용.

---

## 공통 인프라 (선행 작업)

<!-- vscodereader 2026-07-30 수정: 기존 선행 작업이었던 KIS REST 클라이언트를
realtime의 실제 구현 파일과 현재 한계로 갱신. -->
- [x] **KIS REST 클라이언트**: OAuth 토큰 발급/DB 영속화, 지수·현재가·차트 호출,
      throttle·캐시 구현. 현재 `apps/realtime/src/services/`에 위치
- [ ] **공유 Zod 스키마/타입**: native data.ts 인터페이스 이관.
- [ ] **서비스 레이어 스캐폴딩** + 라우터 등록 패턴(`routers/index.ts`).

---

## Phase 로드맵

의존성과 검증 난이도 순. 각 Phase는 독립 배포 가능 단위.

### Phase 1 — 시세 읽기 (🟢 KIS, DB 불필요) — realtime 경로로 구현
<!-- vscodereader 2026-07-30 수정: 기존 market oRPC 계획이 realtime REST/SSE로
구현된 사실을 반영하되, market.* 라우터 자체는 만들지 않았음을 명시. -->
- [x] `/index/intraday` → KOSPI/KOSDAQ 장중 지수
- [x] `/quote/snapshot` → 종목 현재가·등락
- [x] `/chart/stock` → 1D/3M/1Y/3Y 차트
- [x] `/quote/sparkline` → 종목 sparkline
- [x] `/stream/quotes` → 관심종목·화면별 실시간 체결 SSE
- [ ] `market.indices/quote/chart` oRPC wrapper는 없음(현재 realtime 직접 연결 유지)

### Phase 2 — 사용자 데이터 (🔵 DB, 🔑 Auth) — 대부분 완료
관심종목·알림·프로필. Phase 1 시세와 결합해 홈④·마이 완성.
- [x] `watchlist.list` / `add` / `remove` (검색 추가·관심종목 화면 연결)
      — 시세·spark는 미연동(Phase 1 대기), score는 Phase 5 전까지 placeholder
- [x] `notification.unreadCount` / `history` / `markRead` / `markAllRead`
      (알림함 화면 실데이터 + mypage 배지·스탯)
- [x] `notification.getSettings` / `updateSettings` (알림설정 DB 저장, hold 포함)
- [x] `notification.registerPushToken` / `unregisterPushToken` (단말 토큰 등록)
- [x] mypage 프로필(세션) + 로그아웃 + 스탯(관심종목·활성시그널·안읽은알림) 실데이터
<!-- vscodereader 2026-07-30 수정: watchlist.list 응답 병합 대신 화면 행 단위
useLiveQuote 방식으로 현재가를 결합한 현재 구현 범위를 정확히 반영. -->
- [x] 관심종목 화면에 실시간 현재가 결합. `watchlist.list` payload에 넣지 않고
      native가 행별 `useLiveQuote`로 종목 구독을 등록
- [ ] 관심종목 행 sparkline은 아직 연결하지 않음
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
- [x] `discussion.messages` / `messagesAround` / `send` /
      `deleteMessage`(soft delete) / `leaveRoom` (채팅, 메시지 읽기 포함 protected)
- [x] 화면 연결: 토론 목록(`screens/discuss`) · 채팅방(`screens/discussion-room`) ·
      방 생성 admin(`screens/discussion-room-new`)
<!-- vscodereader 2026-07-30 수정: 초기 DiscussionRoom 4개 테이블 이후
즐겨찾기·모더레이션·답글·이미지/파일 첨부 스키마가 구현되어 목록에 추가. -->
- [x] DB: `discussion_room` / `discussion_message` / `discussion_room_member` /
      `discussion_room_block` / `discussion_room_like` / `discussion_room_favorite` /
      `moneyroad_image` / `discussion_message_image` / `discussion_file_attachment`
- [x] 관리자 메시지 가림·일괄 soft-delete, 멤버 mute·7일 차단
- [x] 1단계 답글과 이미지 최대 8개·합계 10MB, 파일 1개·개당 20MB 첨부
- [x] 실시간 채팅: **폴링 우선**(`refetchInterval: 5000`,
      [ADR 0001](../../adr/0001-polling-first-ws-later.md)). WS/SSE 전환은 Phase 6

### Phase 5 — 시그널 (⚙️) — 기반 완료, 엔진 남음
**모델 전환**: 소스 기반 → **액션 기반(매수/매도/관망)**. 소스(`tech` 등)는 부가 필드.
- [x] DB `signal` 테이블(action/source/strength/title/body/indicators) + 0003
- [x] `signal.preview`(public 홈 3건) /
      `signal.feed({ action?, code?, window, cursor?, limit })` /
      `signal.counts` / `signal.activeCount`(나머지 protected)
- [x] 화면 연결: 시그널 화면(필터+무한스크롤)·home·mypage 스탯·stock-detail
- [ ] **⚙️ 시그널 엔진(생성기)**: KIS 일봉 → 골든크로스/RSI/거래량 → 액션/strength 산출
      → `signal` 적재. realtime에 구현. 유니버스=관심종목 합집합.
      **체크리스트: [realtime/plan.md](../../realtime/plan.md#시그널-엔진-신규)**
- [ ] `community`(토론 집계)·`event`(공시)·`ai`(예측) 소스 — 향후
- [ ] `score` / `signalBreakdown` 산출 → 홈④·종목상세 backfill

### Phase 6 — 실시간 전환 (⚡ RT)
<!-- vscodereader 2026-07-30 수정: 기존 미구현이었던 관심종목 시세 SSE는
quotes-store/quotes-sse 싱글턴으로 구현 완료. 채팅 메시지 폴링은 의도대로 유지. -->
- [x] 관심종목 현재가를 SSE 구독으로 전환(`apps/realtime` + `quotes-sse`)
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
<!-- vscodereader 2026-07-30 수정: 완료된 KIS REST·native 시세 SSE 백로그를
현재 구현 방식으로 완료 처리하고, 선택적으로 남은 oRPC wrapper만 분리. -->
| ~~KIS REST + native 시세 연결~~ ✅ | realtime REST/SSE로 지수·현재가·차트·관심종목 실데이터화 | `apps/realtime/src/services`, `quotes-sse.ts` |
| `market.*` oRPC wrapper | 현재 realtime 직접 연결을 server oRPC로 감쌀 필요가 생길 때만 검토 | Phase 1 대체 구현 |
| ~~로그인 라우트 게이트 정리~~ ✅ | `AuthGate` 컴포넌트로 watchlist/alerts/settings/mypage 보호 | `components/auth-gate.tsx` |
| 실기기 푸시 발송 검증 | dev build + 실기기에서 속보/시그널 푸시 e2e | [realtime/plan.md](../../realtime/plan.md#다음-단계--푸시-알림-보류) |
| 웹 뉴스 화면 연동 | `apps/web` 뉴스 페이지(앱만 완료) | Phase 3 |
| ~~토론(discuss) 도메인~~ ✅ | DiscussionRoom 채팅방·좋아요·폴링 채팅 (Phase 4 완료) | `routers/discussion.ts` |
| realtime Cloud Run 운영 검증 | native SSE 클라이언트는 완료. 배포·장중 실기기 상태는 외부 환경에서 확인 | [realtime/plan.md](../../realtime/plan.md) |

---

## 미해결 결정사항 (전역)

- [ ] 공유 스키마 위치: `packages/api` 내부 vs 신규 `packages/contracts`.
<!-- vscodereader 2026-07-30 수정: KIS REST 위치가 realtime으로 결정·구현되어
기존 미해결 결정을 완료 상태로 변경. -->
- [x] KIS REST는 현재 `apps/realtime/src/services`에 둔다. 추후 시그널 엔진도
      기존 토큰·차트 함수를 재사용
- [ ] 뉴스 원천 소스/라이선스, AI 요약 생성 시점(배치 vs 온디맨드).
- [ ] 시그널 엔진 실행 형태(배치 잡 vs 온디맨드)와 저장(`signal` 캐시).
- [ ] 실시간 범위: 시세만 vs 채팅 포함, SSE 재사용 vs 분리.
- [ ] 페이지네이션 표준(커서 형식)·에러 코드 규약.

> 각 화면의 세부 미정 항목은 해당 문서의 "미정/결정 필요" 절 참고.
