# server

머니로드의 **API 서버**. 인증(Better Auth), 비즈니스 API(oRPC), AI 스트리밍,
realtime 스트림 토큰 발급을 담당하는 Fastify 호스트다. PostgreSQL(Drizzle)을
저장소로 쓰며, 실시간 시세 스트림은 별도의 [`apps/realtime`](../realtime) 서비스가
처리한다.

```
native app / web ◀──oRPC / auth / ai──▶ server ◀──Drizzle──▶ PostgreSQL
                                          │
                          ┌───────────────┴────────────────┐
                stream-token 발급                   pin 재동기화 트리거
                          ▼                                ▼
                  realtime SSE 접속              realtime /internal/refresh-pins
```

- 비즈니스 데이터·인증은 모두 server(oRPC)에서. **server는 시세를 프록시하지 않는다.**
- 클라이언트는 server에서 받은 토큰으로 realtime SSE에 직접 붙는다.
- 관심종목/시그널 쓰기 시 server가 realtime에 즉시 재동기화를 트리거한다.

> 📐 설계 상세·요청 흐름·플러그인·API 레이어·인증·realtime 연계는
> **[docs/architecture.md](./docs/architecture.md)** 참고.

---

## 빠른 시작 (로컬 개발)

```bash
# 1) 환경 변수 준비
cp .env.example .env
#   최소: DATABASE_URL, BETTER_AUTH_SECRET(≥32자), BETTER_AUTH_URL,
#         CORS_ORIGIN, STREAM_TOKEN_SECRET(≥32자, realtime와 동일)

# 2) 마이그레이션 (스키마 적용)
pnpm -F server build && node apps/server/dist/migrate.mjs
#   또는 packages/db의 drizzle 마이그레이션 도구 사용

# 3) 개발 서버 (저장소 루트 또는 이 디렉터리에서)
pnpm -F server dev          # tsx watch, 기본 :3000

# 4) 동작 확인
curl http://localhost:3000/            # "OK API"
```

`STREAM_TOKEN_SECRET`은 realtime와 동일한 값이어야 토큰 검증·내부 트리거가 동작한다.

---

## 스크립트

| 명령 | 설명 |
|---|---|
| `pnpm -F server dev` | tsx watch 개발 서버 |
| `pnpm -F server build` | tsdown 번들 → `dist/index.mjs`(+ `dist/migrate.mjs`) |
| `pnpm -F server start` | 빌드 산출물 실행 |
| `pnpm -F server check-types` | `tsc -b` 타입 체크 |

---

## HTTP 라우트

| 메서드 · 경로 | 용도 |
|---|---|
| `GET /` | 헬스 응답(`"OK API"`) |
| `ALL /rpc/*` | oRPC 비즈니스 API |
| `ALL /api-reference/*` | OpenAPI 문서 + 레퍼런스 UI |
| `GET/POST /api/auth/*` | Better Auth(세션·소셜 로그인·회원) |
| `POST /ai` | Gemini 채팅 스트림 |
| `POST /stream-token` | realtime 접속용 스트림 토큰 발급(세션 필요) |

---

## API (oRPC) 라우터

`packages/api`에 비즈니스 로직이 있고, server가 `/rpc/*`로 노출한다. 권한은
`publicProcedure` / `protectedProcedure`(세션) / `adminProcedure`(role=admin) 3단계.

| 라우터 | 요약 |
|---|---|
| `news` | 뉴스 피드·상세 (public) |
| `signal` | 시그널 피드·집계(public) · 생성/삭제(admin) |
| `stock` | 종목 검색 (public) |
| `watchlist` | 관심종목 조회/추가/삭제 (protected) |
| `notification` | 알림 설정·내역·푸시토큰 (protected) |
| `discussion` | 토론방·메시지(public/protected) · 방 관리(admin) |
| `priceAlert` | 가격 알림 CRUD (protected) |
| `inquiry` | 1:1 문의 (protected) |

라우터별 프로시저·권한 표는 [docs/architecture.md §5](./docs/architecture.md#5-api-레이어-orpc).

---

## 인증 (Better Auth)

이메일/비밀번호 + 소셜 로그인(Google·Apple·Naver·Kakao — 키가 있는 provider만
활성화). `admin`·`username`·`expo`·`i18n` 플러그인 사용. 세션은 `httpOnly` 쿠키
(`sameSite: none` + `secure`)로 크로스 도메인을 지원한다. 구성은 `packages/auth`.

자세한 내용은 [docs/architecture.md §6](./docs/architecture.md#6-인증--better-auth).

---

## 환경 변수

`.env.example`에 전체 목록과 설명이 있다. 핵심만:

| 변수 | 필수 | 비고 |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL 접속 문자열 |
| `BETTER_AUTH_SECRET` | ✅ | 세션 서명(≥32자) |
| `BETTER_AUTH_URL` / `CORS_ORIGIN` | ✅ | 인증 베이스 URL / 허용 오리진 |
| `STREAM_TOKEN_SECRET` | ✅ | realtime와 동일(≥32자) |
| `REALTIME_INTERNAL_URL` | — | 기본 `http://localhost:3001`. 미설정 시 폴링 폴백 |
| `GOOGLE_GENERATIVE_AI_API_KEY` | `/ai` 시 | Gemini 키 |
| `*_CLIENT_ID` / `*_CLIENT_SECRET` | 소셜 시 | provider별 키 |

---

## 배포

Cloud Run + Cloud SQL(PostgreSQL 18) + Secret Manager + Artifact Registry. 마이그레이션은
서비스 부팅과 분리된 **Cloud Run Job으로 먼저 1회 실행**한 뒤 서비스를 배포한다.

전체 런북·시크릿·Cloud SQL 설정은 **[deploy/README.md](./deploy/README.md)** 참고.

핵심:
- `--min-instances=0 --max-instances=4` (scale-to-zero 허용 — realtime과 달리 상시 연결 없음)
- 배포 순서: ① 빌드 → ② 마이그레이션 Job → ③ 서비스 배포
