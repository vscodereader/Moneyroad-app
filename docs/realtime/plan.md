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

### 엔드포인트
- realtime `GET /stream/quotes?symbols=005930,000660&token=<서명토큰>` → `event: quote` 스트림 (토큰 없으면 401, Accept 미협상 시 406)
- realtime `GET /healthz` → `{ status, clients }`
- server `POST /stream-token` → `{ token, expiresIn }` (로그인 세션 필요, 미인증 401)
