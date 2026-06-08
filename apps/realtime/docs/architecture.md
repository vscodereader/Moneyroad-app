# Realtime 서비스 아키텍처

실시간 종목 시세와 뉴스를 **SSE(Server-Sent Events)로 단방향 푸시**하는 독립
서비스. API 서버(`apps/server`)와는 별도의 프로세스/배포 단위로 동작한다.

---

## 1. 토폴로지 한눈에 보기

```
                    ┌──────────────────────────────────────────┐
   ┌──────────┐     │              realtime (단일 인스턴스)       │      ┌──────────────┐
   │   KIS    │     │                                          │      │  native app  │
   │ 시세서버  │◀───▶│  KisFeed ──▶ QuoteHub ──▶ SSE(/stream)  │─────▶│   (client 1) │
   │(WebSocket)│ 1:1 │   (1 WS)     (fan-out)                   │ 1:n  ├──────────────┤
   └──────────┘     │      ▲           ▲                       │─────▶│  (client 2)  │
                    │      │           │ pin                   │ ...  ├──────────────┤
                    │  pinned-poller ──┘                       │─────▶│  (client N)  │
                    │      ▲    ▲ (10s 폴링 + 즉시 트리거)        │      └──────────────┘
                    └──────┼────┼──────────────────────────────┘             │
                           │    │ POST /internal/refresh-pins                 │ ① 토큰 요청
                           │    │ (x-internal-secret)                         ▼
                    DB ◀───┘  ┌─┴───────────────────────────┐        ┌──────────────┐
                  (관심종목/   │      api server (oRPC)        │◀───────│  POST /stream │
                   시그널)     │  - 비즈니스 데이터 / 인증       │   ②    │    -token     │
                              │  - stream-token 발급          │ 토큰 발급 └──────────────┘
                              └──────────────────────────────┘
```

- **KIS ↔ realtime = 1:1** — KIS는 자격증명당 실시간 연결 1개만 허용한다. `KisFeed`가
  단일 WebSocket으로 모든 종목을 멀티플렉싱한다.
- **realtime ↔ 클라이언트 = 1:n** — `QuoteHub`가 1개의 upstream 피드를 N개의 SSE
  클라이언트로 fan-out 한다.
- **클라이언트는 realtime 또는 server에서만 데이터를 수신** — 시세/뉴스 스트림은
  realtime에 직접 연결, 그 외 비즈니스 데이터(관심종목·시그널·뉴스 피드·인증)는
  server(oRPC)에서 받는다. **server는 시세를 프록시하지 않는다.**

---

## 2. 설계 원칙

| 원칙 | 구현 |
|---|---|
| **Upstream 추상화** | `MarketDataFeed` 인터페이스로 KIS/Mock을 교체 가능(`feed/types.ts`). 로컬·테스트는 자격증명 없이 `MockFeed` 랜덤워크로 전체 파이프라인 구동 |
| **단일 연결, 다중 구독** | KIS 1연결을 `QuoteHub`가 종목별 ref-count로 공유. 첫 관심에서 upstream 구독, 마지막 관심 해제 시 구독 해지 |
| **무상태 인증** | realtime은 DB 조회 없이 HMAC 서명 토큰만 검증(`@moneyroad-app/stream-token`). 인증 책임은 server에 집중 |
| **백프레셔 안전** | SSE 브리지는 큐 + wake 루프로 느린 클라이언트가 다른 클라이언트를 막지 않게 함(`quotes.ts streamQuotes`) |
| **점진적 기능 활성화** | DB·뉴스·AI 키가 없으면 순수 시세 피드로만 동작. 키가 있을 때만 뉴스 수집/푸시/종목마스터 갱신 활성화 |

---

## 3. 데이터 흐름

### 3.1 시세 (Quotes)

```
KIS WS ─tick─▶ KisFeed.handleMessage ─parse─▶ handler(quote)
                                                  │
                                       QuoteHub.broadcast(quote)
                                                  │  (symbol 구독자만)
                                     ┌────────────┼────────────┐
                                   client.send  client.send  client.send
                                     │            │            │
                                streamQuotes 큐 ─yield─▶ reply.sse.send  ─▶  EventSource
```

1. `KisFeed`가 KIS WebSocket에서 파이프 구분 프레임을 수신해
   `Quote{ symbol, price, change, changeRate, volume, ts }`로 파싱한다.
   체결가(`H0STCNT0`)와 지수(`H0UPCNT0`)는 필드 레이아웃이 달라 `tr_id`로 분기한다.
2. `QuoteHub.broadcast`가 해당 symbol을 구독 중인 클라이언트에게만 전달한다.
3. 각 SSE 클라이언트는 `streamQuotes` async generator로 연결되어 큐에 쌓인 tick을
   `event: quote`로 흘려보낸다. 클라이언트 연결 종료(abort) 시 generator가 끝나며
   구독을 정리한다.

### 3.2 뉴스 (News)

`QuoteHub`와 구조는 유사하지만 upstream 구독 ref-count가 없다. 수집기가 모든
신규 항목을 `NewsHub`로 push하고, 각 클라이언트가 symbol/category로 필터링한다.

```
Naver API ─poll─▶ collector ─▶ NewsHub.broadcast ─filter─▶ streamNews ─▶ event: news
```

---

## 4. 핵심 컴포넌트

### `QuoteHub` (`services/hub.ts`)
인메모리 fan-out 허브. 관심(interest)의 두 출처를 합집합으로 관리한다.

- **subscribers** — SSE 클라이언트가 원하는 종목 (`addClient`/`removeClient`)
- **pinned** — 관심종목 ∪ 시그널 종목 (SSE 클라이언트와 무관하게 상시 구독)

upstream 구독/해지는 종목이 **(subscribers ∪ pinned)** 합집합에 처음 진입하거나
완전히 빠질 때만 발생한다. pinned가 있으면 SSE 클라이언트가 모두 떠나도 구독이
유지되어 알람 평가용 tick이 끊기지 않는다.

### `MarketDataFeed` 어댑터 (`services/feed/`)
- **`KisFeed`** — approval_key 발급(REST) → WS 1연결 → `tr_type`별 등록/해제. 연결이
  끊기면 지수 백오프(1s→30s)로 재연결하고 등록 종목을 재구독. PINGPONG echo로
  연결 유지. **KIS 연결당 ~40종목 등록 한도**를 코드 상수로 가드한다.
- **`MockFeed`** — 랜덤워크. 자격증명 없이 SSE 파이프라인 전체를 검증.

### SSE 브리지 (`services/quotes.ts` / `services/news.ts`)
push 기반 허브를 async generator로 변환해 `reply.sse.send(...)`에 전달한다. 큐 +
wake 패턴으로 tick 유실 없이 클라이언트 연결이 끊길 때까지 핸들러를 pending 상태로
유지한다.

### `pinned-poller` (`services/pinned-poller.ts`)
DB의 (관심종목 ∪ 시그널 종목)을 읽어 `QuoteHub.setPins`로 동기화하고, 비로그인
사용자에게도 허용할 `publicSignalSymbols` 화이트리스트를 갱신한다.

- **주기 폴링** — 기본 10초(`WATCHLIST_POLL_INTERVAL_MS`)
- **즉시 트리거** — server가 관심종목/시그널 변경 직후 호출(아래 §6)
- **single-flight + rerun 가드** — 폴링 중 들어온 트리거를 잃지 않도록 한 번 더 패스

### 내부 트리거 플러그인 (`plugins/internal.ts`)
`POST /internal/refresh-pins`. server가 쓰기 직후 호출해 pin 재동기화를 즉시 유발.
`STREAM_TOKEN_SECRET`을 `x-internal-secret` 헤더로 받아 상수시간 비교로 인증한다.
**공개 인터넷에 노출 금지**(내부망 전용).

---

## 5. 인증 — Stream Token

realtime은 세션/DB를 모른다. 대신 server와 공유하는 `STREAM_TOKEN_SECRET`으로
서명된 짧은 수명의 토큰을 검증한다.

```
① native app ──POST /stream-token (세션 쿠키)──▶ api server
② api server ──signStreamToken({sub, exp}, SECRET)──▶ { token, expiresIn: 120 }
③ native app ──GET /stream/quotes?token=<token>──▶ realtime  (HMAC 검증, DB 무관)
```

- 토큰 형식: `<base64url payload>.<base64url HMAC-SHA256>` (`packages/stream-token`)
- TTL 120초 — 발급~연결 사이 간격만 커버. 연결 후에는 SSE가 계속 열려 있다.
- 토큰은 query string으로 전달한다(웹 `EventSource`가 헤더를 못 넣고, 인증 쿠키는
  server 도메인에 스코프되어 realtime로 전달되지 않기 때문).

### 인가 규칙

| 요청자 | 허용 종목 |
|---|---|
| 유효 토큰 보유 | **모든 종목** |
| 익명(토큰 없음) | 공개 화이트리스트만 — 시장 지수(`0001`/`1001`) ∪ `publicSignalSymbols`(관리자 등록 시그널 종목) |

비로그인 사용자도 홈에 노출되는 시그널 종목 시세는 볼 수 있어야 하므로
`publicSignalSymbols`를 익명 허용 목록에 포함한다.

---

## 6. 즉시 동기화 (폴링 대기 제거)

관심종목/시그널이 새로 추가되면, 10초 폴링을 기다리지 않고 즉시 반영된다.

```
사용자 관심종목 추가
   │
api server (watchlist.add) ──DB write──▶ refreshRealtimePins("watchlist.add")
   │                                          │ fire-and-forget, 2s timeout
   │                                          ▼
   │            POST {REALTIME_INTERNAL_URL}/internal/refresh-pins
   │                       (x-internal-secret: STREAM_TOKEN_SECRET)
   ▼                                          ▼
realtime: triggerPinsRefresh() ──▶ pollOnce() ──▶ QuoteHub.setPins(관심∪시그널)
                                                       │
                                              KIS WS에 신규 종목 구독 → tick 흐름
```

- 호출 지점: `packages/api/src/routers/{watchlist,signal}.ts`의
  add/remove/create 직후
- `REALTIME_INTERNAL_URL` 미설정/도달 불가 시 → 조용히 10초 폴링으로 폴백
  (fire-and-forget이라 server 응답을 막지 않음)

---

## 7. 엔드포인트

| 메서드 · 경로 | 용도 | 인증 |
|---|---|---|
| `GET /`, `/healthz`, `/healthz/news` | 헬스체크 | 없음 |
| `GET /stream/quotes?symbols=&token=` | 시세 SSE (`event: quote`) | 토큰(익명은 공개 종목만) |
| `GET /stream/news?symbols=&categories=&token=` | 뉴스 SSE (`event: news`) | 토큰 필수 |
| `GET /quote/snapshot?symbols=&token=` | 마지막 시세 스냅샷(SSE 시드) | 토큰(익명은 공개 종목만) |
| `GET /quote/sparkline?code=&token=` | 최근 ~30일 종가 스파크라인 | 토큰 or 공개 종목 |
| `GET /chart/stock?code=&range=&token=` | 종목 차트(1D/3M/1Y/3Y) | 토큰 필수 |
| `GET /index/intraday?symbols=&token=` | 지수 당일 분봉 시드 | 토큰(익명은 지수만) |
| `GET /api/news?limit=&category=&stockCode=` | 저장 뉴스 조회(REST) | 없음(DB 필요) |
| `POST /internal/refresh-pins` | pin 즉시 재동기화 | `x-internal-secret` · **내부 전용** |

---

## 8. 환경 변수 (요약)

| 변수 | 필수 | 설명 |
|---|---|---|
| `PORT` | — | 기본 3001(로컬) / 8080(Cloud Run 주입) |
| `FEED` | — | `mock`(기본) 또는 `kis` |
| `STREAM_TOKEN_SECRET` | ✅ | server와 **동일**해야 함(≥32자). 토큰 검증 + 내부 트리거 인증 |
| `HEARTBEAT_MS` | — | SSE 하트비트(기본 15000) |
| `KIS_ENV` / `KIS_APP_KEY` / `KIS_APP_SECRET` | `FEED=kis`일 때 | KIS 자격증명 |
| `DATABASE_URL` | 뉴스/pin 시 | 미설정 시 순수 시세 피드로만 동작 |
| `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` | 뉴스 시 | 네이버 검색 API |
| `GOOGLE_GENERATIVE_AI_API_KEY` | AI 요약 시 | 없으면 휴리스틱 분류 |
| `WATCHLIST_POLL_INTERVAL_MS` | — | pin 폴링 주기(기본 10000) |
| `STOCK_MASTER_CRON` / `STOCK_MASTER_TZ` | — | 종목마스터 갱신(기본 매일 06:00 KST) |

> server 측에는 `REALTIME_INTERNAL_URL`(기본 `http://localhost:3001`)이 필요하다.
> 배포 시 realtime 내부 주소로 설정해야 즉시 동기화가 동작한다.

전체 목록은 `.env.example` 참고.

---

## 9. 확장성과 한계 (Phase 1 → Phase 2)

현재는 **Phase 1: 단일 인스턴스**(min=max=1)다. KIS 1연결 + fan-out을 한 프로세스의
인메모리 맵으로 처리하므로 Redis가 필요 없다. 대신 다음 경계를 인지해야 한다.

| 한계 | 현재 동작 | Phase 2 대응 |
|---|---|---|
| **수평 확장 불가** | 구독/pin 상태가 프로세스 인메모리(`Map`/`Set`) | Redis pub/sub 백플레인으로 인스턴스 간 tick 분배 |
| **KIS 종목 한도** | 연결당 ~40종목. (subscribers ∪ pinned) 합집합이 한도 초과 시 `log.warn` 후 신규 등록 드롭(`kis.ts subscribe`) | ingestion 분리 + 다중 연결 샤딩 |
| **상시 비용** | CPU 상시 할당(KIS 수신 루프 유지)이라 scale-to-zero 불가 | ingestion(min=1)과 fan-out(N) 분리 |

> Phase 1에서 가장 먼저 마주칠 실질 경계는 **KIS 연결당 40종목 한도**다.
> 관심종목 ∪ 시그널 종목 합집합이 40을 넘으면 초과분 tick이 누락되므로,
> 그 전에 다중 연결 샤딩 또는 ingestion 분리를 도입해야 한다.

배포 절차와 Cloud Run 설정은 [`../deploy/README.md`](../deploy/README.md) 참고.
