# Server 아키텍처

머니로드의 **API 서버**. 인증, 비즈니스 API(oRPC), AI 스트리밍, realtime 스트림
토큰 발급을 담당하는 Fastify 호스트다. PostgreSQL(Drizzle)을 데이터 저장소로 쓰며,
시세 실시간 스트림은 별도의 `apps/realtime` 서비스가 처리한다.

---

## 1. 토폴로지 한눈에 보기

```
                          ┌─────────────────────────────────────────────────┐
                          │                api server (Fastify)              │
   ┌──────────────┐       │  preHandler: evlog · identifyUser · CORS         │
   │  native app  │       │                                                  │
   │   / web      │──HTTP─▶│  ┌────────────┬──────────┬───────┬───────────┐  │
   └──────────────┘       │  │  /rpc/*    │/api/auth/*│ /ai   │/stream-   │  │
          │               │  │  (oRPC)    │(BetterAuth)│(Gemini)│ token    │  │
          │               │  └─────┬──────┴─────┬─────┴───────┴─────┬─────┘  │
          │               │        │            │                   │        │
          │               └────────┼────────────┼───────────────────┼────────┘
          │                        │ packages/   │                   │ sign(SECRET)
          │                        │   api       │                   │
          │ ① POST /stream-token   ▼             ▼                   ▼
          │   (세션 쿠키)      ┌─────────┐   ┌──────────┐      { token, 120s }
          │                   │ Postgres │   │ Postgres │            │
          │                   │ (Drizzle)│   │ (auth)   │            │
          │                   └─────────┘   └──────────┘            │
          │                        ▲                                 │
          │   watchlist/signal 쓰기 │ refreshRealtimePins()           │
          │                        │ POST /internal/refresh-pins     │
          │                        ▼                                 ▼
          │                  ┌──────────────────────────────────────────┐
          └─────② 토큰으로──▶ │           realtime (SSE 시세/뉴스)         │
            SSE 직접 연결      └──────────────────────────────────────────┘
```

- **클라이언트 ↔ server** — 인증·관심종목·시그널·뉴스 피드·알림 등 모든 비즈니스
  데이터는 server의 oRPC API로 주고받는다.
- **server → realtime (토큰 발급)** — 클라이언트가 realtime SSE에 붙기 전, server가
  세션을 검증하고 짧은 수명의 HMAC 스트림 토큰을 발급한다.
- **server → realtime (pin 트리거)** — 관심종목/시그널 쓰기 직후 realtime의 내부
  엔드포인트를 호출해 즉시 재동기화시킨다(`realtime-trigger.ts`).
- **server는 시세를 프록시하지 않는다** — 실시간 시세 스트림은 클라이언트가
  realtime에 직접 연결한다. (realtime 구조는 [`../../realtime/docs/architecture.md`](../../realtime/docs/architecture.md) 참고.)

---

## 2. 구성 — 앱 셸 + API 패키지

비즈니스 로직과 HTTP 호스팅이 분리되어 있다.

| 위치 | 책임 |
|---|---|
| **`apps/server`** | Fastify 앱 셸. 플러그인 등록, CORS, 로깅, 부팅/종료. 배포 단위 |
| **`packages/api`** | oRPC 라우터(비즈니스 로직). server가 import 해 `/rpc/*`로 노출 |
| **`packages/auth`** | Better Auth 인스턴스 구성(provider·plugin·adapter) |
| **`packages/db`** | Drizzle 스키마·마이그레이션·DB 클라이언트 |
| **`packages/stream-token`** | HMAC 토큰 서명/검증(server·realtime 공유) |
| **`packages/env`** | 타입 안전 환경변수(`@t3-oss/env-core` + zod) |

---

## 3. 요청 처리 흐름

```
요청 ─▶ evlog(wide event) ─▶ identifyUser(preHandler) ─▶ CORS ─▶ 플러그인 라우트
```

- **evlog** — 요청당 하나의 wide event를 남기는 구조적 로깅(`evlog/fastify`).
- **identifyUser** — `preHandler` 훅에서 Better Auth 세션을 풀어 로거에 사용자
  컨텍스트를 주입한다(이메일 마스킹). `/api/auth/**`는 제외.
- **CORS** — `CORS_ORIGIN`만 허용, `credentials: true`(쿠키 세션).
- 각 플러그인은 **캡슐화된 컨텍스트**로 등록되어 플러그인별 content-type 파서가
  서로 간섭하지 않는다(oRPC는 `*`, auth는 `application/json` buffer passthrough).

---

## 4. 플러그인 (HTTP 라우트)

| 플러그인 | 라우트 | 역할 |
|---|---|---|
| `orpc.ts` | `ALL /rpc/*` | oRPC RPC 핸들러 — 비즈니스 API 본체 |
| `orpc.ts` | `ALL /api-reference/*` | OpenAPI 핸들러 + 레퍼런스 UI(스키마 자동 변환) |
| `auth.ts` | `GET/POST /api/auth/*` | Better Auth 핸들러로 위임(세션·소셜 로그인·회원) |
| `ai.ts` | `POST /ai` | Gemini `streamText` → UI 메시지 스트림(텔레메트리 연동) |
| `stream-token.ts` | `POST /stream-token` | realtime 접속용 스트림 토큰 발급(세션 필요, TTL 120초) |
| (root) | `GET /` | `"OK API"` 헬스 응답 |

### 개발 편의 — 에러 언마스킹
`orpc.ts`는 개발 환경에서만 `INTERNAL_SERVER_ERROR`의 원본 메시지·스택을 노출하는
`clientInterceptor`를 단다. 운영에서는 일반화된 메시지를 유지한다.

---

## 5. API 레이어 (oRPC)

### 컨텍스트와 프로시저

`createContext`가 요청 헤더에서 Better Auth 세션을 해석해 모든 핸들러에 주입한다
(`packages/api/src/context.ts`). 그 위에 3단계 권한 프로시저가 있다
(`packages/api/src/index.ts`).

| 프로시저 | 게이트 | 용도 |
|---|---|---|
| `publicProcedure` | 없음 | 비로그인 허용(뉴스·시그널 피드·종목 검색 등) |
| `protectedProcedure` | 세션 필수 | 사용자별 데이터(관심종목·알림·문의 등). 없으면 `UNAUTHORIZED` |
| `adminProcedure` | `role = 'admin'` | 관리자 전용(시그널 생성/삭제·토론방 관리). 없으면 `FORBIDDEN` |

### 라우터 카탈로그 (`appRouter`)

| 라우터 | 주요 프로시저 | 권한 |
|---|---|---|
| `news` | `feed`, `detail` | public |
| `signal` | `feed`·`counts`(public) · `create`·`remove`(admin) · `activeCount`(protected) | 혼합 |
| `stock` | `search` | public |
| `watchlist` | `list`·`add`·`remove` | protected (+ realtime 트리거) |
| `notification` | 설정·내역·읽음·푸시토큰 등록/해제 | protected |
| `discussion` | `rooms`·`room`·`messages`(public) · 작성/좋아요/탈퇴(protected) · 방 CRUD(admin) | 혼합 |
| `priceAlert` | `list`·`create`·`setActive`·`remove` | protected |
| `inquiry` | `create` | protected |
| `todo` | `getAll`·`create`·`toggle`·`delete` | public (스캐폴드) |

루트에는 `healthCheck`(public), `privateData`(protected)가 있다.

---

## 6. 인증 — Better Auth

`packages/auth`에서 구성한다.

- **어댑터** — Drizzle(`pg`), 스키마는 `@moneyroad-app/db/schema/auth`
- **방식** — 이메일/비밀번호 + 소셜 로그인. 소셜은 **키가 설정된 provider만**
  활성화(Google·Apple 내장, Naver·Kakao는 generic OAuth)
- **플러그인** — `admin`(role 기반 권한) · `username` · `expo`(네이티브 딥링크) · `i18n`(한국어 에러)
- **세션** — `httpOnly` 쿠키, `sameSite: none` + `secure`(크로스 도메인). `trustedOrigins`에
  앱 딥링크(`moneyroad.ai.kr://`)·Apple 콜백·dev용 Expo origin 포함
- **노출** — server는 `/api/auth/*`를 Better Auth 핸들러로 그대로 위임한다(`auth.ts`)

---

## 7. realtime 연계

server는 realtime과 **두 가지 방향**으로 연결되지만, 시세 데이터 자체는 주고받지
않는다.

1. **스트림 토큰 발급** — 클라이언트가 `POST /stream-token`(세션 쿠키)으로 요청하면
   server가 `signStreamToken({ sub, exp }, STREAM_TOKEN_SECRET)`로 120초 토큰을
   발급한다. 클라이언트는 이 토큰으로 realtime SSE에 직접 붙고, realtime은 DB 없이
   서명만 검증한다.

2. **pin 즉시 재동기화** — `watchlist`/`signal` 쓰기 직후 `refreshRealtimePins()`가
   `POST {REALTIME_INTERNAL_URL}/internal/refresh-pins`를 fire-and-forget(2초
   타임아웃)으로 호출한다. 인증은 `STREAM_TOKEN_SECRET`을 `x-internal-secret`
   헤더로 재사용한다. 실패하면 realtime의 10초 폴링으로 폴백되므로 **정확성이 아니라
   반영 속도만** 영향받는다.

```
client ──POST /stream-token(세션)──▶ server ──sign──▶ token ──▶ realtime SSE
client ──watchlist.add──▶ server ──DB write──▶ refreshRealtimePins ──▶ realtime
```

> 두 서비스가 공유하는 `STREAM_TOKEN_SECRET`은 **반드시 동일한 값**이어야 한다
> (토큰 검증 + 내부 트리거 인증 양쪽에 쓰임). realtime 측 상세는
> [realtime architecture §5–6](../../realtime/docs/architecture.md#5-인증--stream-token).

---

## 8. 데이터 · 마이그레이션

- **ORM** — Drizzle(`packages/db`). 라우터는 `db` 클라이언트로 직접 쿼리한다.
- **마이그레이션 분리** — 마이그레이션은 서비스 부팅과 분리되어 있다(`migrate.ts` →
  `dist/migrate.mjs`). 배포 시 **Cloud Run Job으로 1회 먼저 실행**한 뒤 서비스를
  배포한다. 앱은 stateless하게 유지된다.
- **DB 인스턴스** — 운영은 Cloud SQL for PostgreSQL 18. 유닉스 소켓으로 접속
  (`DATABASE_URL`의 host에 소켓 경로).

---

## 9. 환경 변수 (요약)

| 변수 | 필수 | 설명 |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL 접속 문자열 |
| `BETTER_AUTH_SECRET` | ✅ | 세션 서명 시크릿(≥32자) |
| `BETTER_AUTH_URL` | ✅ | 인증 베이스 URL(배포 후 실제 URL로 갱신) |
| `CORS_ORIGIN` | ✅ | 허용 오리진(앱 도메인) |
| `STREAM_TOKEN_SECRET` | ✅ | realtime와 **동일**(≥32자). 토큰 발급 + 내부 트리거 인증 |
| `REALTIME_INTERNAL_URL` | — | realtime 내부 주소(기본 `http://localhost:3001`). 미설정 시 폴링 폴백 |
| `PORT` | — | 기본 3000(로컬) / 8080(Cloud Run 주입) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | `/ai` 사용 시 | Gemini 키 |
| `GOOGLE/APPLE/NAVER/KAKAO_CLIENT_ID·SECRET` | 소셜 로그인 시 | provider별 키(있을 때만 활성화) |

전체 목록은 [`.env.example`](../.env.example) 참고.

---

## 10. 배포 · 확장

- **플랫폼** — Cloud Run + Cloud SQL + Secret Manager + Artifact Registry, 빌드는
  Cloud Build(`linux/amd64`).
- **스케일** — `--min-instances=0 --max-instances=4`. realtime과 달리 **scale-to-zero**가
  가능하다(상시 업스트림 연결이 없으므로). 콜드스타트는 인증/oRPC 요청 특성상 허용.
- **배포 순서** — ① 이미지 빌드 → ② 마이그레이션 Job 실행 → ③ 서비스 배포.

배포 런북·시크릿·Cloud SQL 설정은 [`../deploy/README.md`](../deploy/README.md) 참고.
