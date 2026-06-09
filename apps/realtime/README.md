# realtime

머니로드의 **실시간 시세·뉴스 푸시 서비스**. KIS(한국투자증권) 실시간 체결가를
단일 WebSocket으로 받아, 다수의 클라이언트에게 SSE로 fan-out 한다. API
서버(`apps/server`)와는 별도로 동작하는 독립 Fastify 서비스다.

```
KIS 시세서버 ◀──1:1──▶ realtime ◀──1:n──▶ native app (clients)
```

- **KIS ↔ realtime = 1:1** — KIS는 자격증명당 연결 1개만 허용. 단일 WS로 모든 종목 멀티플렉싱.
- **realtime ↔ 클라이언트 = 1:n** — `QuoteHub`가 1개 피드를 N개 SSE 클라이언트로 분배.
- **클라이언트는 realtime/server에서만 데이터 수신** — 시세·뉴스 스트림은 realtime 직접
  연결, 비즈니스 데이터·인증은 server(oRPC). server는 시세를 프록시하지 않는다.

> 📐 설계 상세·데이터 흐름·컴포넌트·확장 계획은 **[docs/architecture.md](./docs/architecture.md)** 참고.

---

## 빠른 시작 (로컬 개발)

```bash
# 1) 환경 변수 준비 — 최소 설정은 mock 피드라 자격증명이 필요 없다
cp .env.example .env
#   STREAM_TOKEN_SECRET 만 32자 이상으로 채우면 SSE까지 동작
#   (server의 STREAM_TOKEN_SECRET과 동일한 값이어야 한다)

# 2) 개발 서버 (저장소 루트 또는 이 디렉터리에서)
pnpm -F realtime dev        # tsx watch, 기본 :3001

# 3) 동작 확인 (토큰 없이 지수는 공개 → 스트림 확인 가능)
curl -N -H "Accept: text/event-stream" \
  "http://localhost:3001/stream/quotes?symbols=0001,1001"
```

`FEED=mock`(기본)은 랜덤워크로 KIS 자격증명 없이 전체 SSE 파이프라인을 검증한다.
실제 시세는 `FEED=kis` + `KIS_APP_KEY`/`KIS_APP_SECRET`이 필요하다.

뉴스 수집·관심종목 pin 동기화는 `DATABASE_URL`이 있을 때만 활성화된다. 없으면
순수 시세 피드로 동작한다.

---

## 스크립트

| 명령 | 설명 |
|---|---|
| `pnpm -F realtime dev` | tsx watch 개발 서버 |
| `pnpm -F realtime build` | tsdown 번들 → `dist/index.mjs` |
| `pnpm -F realtime start` | 빌드 산출물 실행 |
| `pnpm -F realtime check-types` | `tsc -b` 타입 체크 |
| `pnpm -F realtime load:stock-master` | KIS 종목마스터 수동 적재 |

---

## 엔드포인트

| 메서드 · 경로 | 용도 |
|---|---|
| `GET /`, `/healthz`, `/healthz/news` | 헬스체크 |
| `GET /stream/quotes?symbols=&token=` | 시세 SSE (`event: quote`) |
| `GET /stream/news?symbols=&categories=&token=` | 뉴스 SSE (`event: news`) |
| `GET /quote/snapshot?symbols=&token=` | 마지막 시세 스냅샷(SSE 시드) |
| `GET /quote/sparkline?code=&token=` | 최근 ~30일 종가 스파크라인 |
| `GET /chart/stock?code=&range=&token=` | 종목 차트(1D/3M/1Y/3Y) |
| `GET /index/intraday?symbols=&token=` | 지수 당일 분봉 시드 |
| `GET /api/news?limit=&category=&stockCode=` | 저장 뉴스 조회(REST) |
| `POST /internal/refresh-pins` | pin 즉시 재동기화 · **내부 전용** |

엔드포인트별 인증 규칙은 [docs/architecture.md §7](./docs/architecture.md#7-엔드포인트) 참고.

---

## 인증 (Stream Token)

realtime은 세션/DB를 모른다. 클라이언트는 server에서 짧은 수명(120초)의 HMAC 토큰을
발급받아 `?token=`으로 전달하고, realtime은 공유 `STREAM_TOKEN_SECRET`으로 서명만
검증한다(DB 조회 없음). 익명 요청은 시장 지수 + 관리자 등록 시그널 종목만 허용된다.

```
native app ─POST /stream-token(세션)─▶ api server ─sign(SECRET)─▶ token
native app ─GET /stream/quotes?token=─▶ realtime ─verify(SECRET)─▶ SSE
```

자세한 토큰 흐름·인가 규칙은 [docs/architecture.md §5](./docs/architecture.md#5-인증--stream-token).

---

## 환경 변수

`.env.example`에 전체 목록과 설명이 있다. 핵심만:

| 변수 | 필수 | 비고 |
|---|---|---|
| `STREAM_TOKEN_SECRET` | ✅ | server와 동일(≥32자) |
| `FEED` | — | `mock`(기본) / `kis` |
| `KIS_APP_KEY` / `KIS_APP_SECRET` / `KIS_ENV` | `FEED=kis`일 때 | KIS 자격증명 |
| `DATABASE_URL` | 뉴스·pin 시 | 없으면 순수 시세 피드 |
| `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` | 뉴스 시 | 네이버 검색 API |

> server에는 `REALTIME_INTERNAL_URL`(기본 `http://localhost:3001`)이 필요하다. 배포
> 시 realtime 내부 주소로 설정해야 관심종목/시그널 변경이 폴링 대기 없이 즉시
> 반영된다(미설정 시 10초 폴링 폴백).

---

## 배포

Cloud Run(Phase 1, 단일 인스턴스) 배포 절차·필수 플래그·시크릿은
**[deploy/README.md](./deploy/README.md)** 참고.

핵심 제약:
- `--no-cpu-throttling` (백그라운드 KIS 수신 루프 유지)
- `--min-instances=1 --max-instances=1` (KIS 1연결 보장)
- `--timeout=3600 --concurrency=250` (SSE 장기 연결)
