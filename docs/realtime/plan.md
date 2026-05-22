# Realtime 시세 서비스 — 작업 계획

종목 시세를 **SSE(단방향)**로 클라이언트에 푸시하는 서비스. API 서버
(`moneyroad-server`)와 분리된 별도 Cloud Run 서비스(`apps/realtime`).

- 코드: `apps/realtime/`
- 배포 런북: `apps/realtime/deploy/README.md`
- 전송: SSE (`text/event-stream`). 시세는 서버→클라 단방향이라 WebSocket 대신 채택.

---

## 현재 상태 (Phase 1 스켈레톤 — 완료)

- [x] Fastify SSE 엔드포인트 `GET /stream/quotes?symbols=005930,000660`
- [x] `GET /` , `GET /healthz`
- [x] `QuoteHub`: 클라↔종목 fan-out + 종목 ref-count(수요 기반 등록/해제)
- [x] `MarketDataFeed` 인터페이스 + `MockFeed`(랜덤워크, 자격증명 불필요)
- [x] `KisFeed` **스켈레톤** (approval_key 발급 / WS 접속 / 등록·해제 — 파싱은 TODO)
- [x] SSE 헤더·이벤트·하트비트, 연결 종료 시 정리
- [x] Dockerfile(멀티스테이지) + cloudbuild `_DOCKERFILE` 파라미터화
- [x] 로컬/컨테이너 e2e 검증 (mock 피드)

> 아직 **Cloud Run에 배포하지 않음** (always-on 비용 때문에 보류).

---

## 아키텍처

**Phase 1 (현재): 단일 인스턴스, Redis 불필요**
```
[앱/웹] --SSE--> [realtime (Cloud Run min=max=1, CPU 상시)] --1연결--> [KIS 실시간]
```
한 프로세스가 KIS 1연결 + 클라 fan-out을 모두 처리(메모리 공유).

**Phase 2 (스케일): Ingestion 분리 + Redis 백플레인**
```
[KIS] --1연결--> [Ingestion(min=max=1)] --pub--> [Memorystore Redis] --sub--> [SSE 서버 1..N] --> 앱/웹
```

---

## 남은 작업

### 1. KIS 어댑터 완성 — `apps/realtime/src/feed/kis.ts` (우선순위 높음)
- [ ] 실시간 시세 TR 스펙 확정 (체결가 `H0STCNT0`, 필요 시 호가 `H0STASP0`)
      → KIS 문서 / `kis-code-assistant-mcp`로 정확한 필드 인덱스 확인
- [ ] `parseTradeFrame` 실제 필드 매핑 (현재가/체결시각/등락/거래량 인덱스)
- [ ] 다건 프레임 처리 (`tr_key` 응답에 여러 레코드가 `^`/반복으로 올 수 있음)
- [ ] PINGPONG 수신 시 동일 페이로드 echo 응답
- [ ] 등록 응답(JSON)에서 암호화 키/IV 처리 — 암호화 스트림일 경우 AES 복호화
- [ ] WebSocket close 시 지수 백오프 재연결 + 재연결 후 기존 종목 재등록
- [ ] approval_key 만료 갱신
- [ ] 등록 종목 수 제한(세션당 ~40) 대응: 초과 시 정책(거부/큐잉/계정 분리)
- [ ] `Quote`에 등락률/거래량 등 필드 채우기 (`types.ts` 확장)

### 2. 클라이언트 연동
- [ ] **앱(React Native)**: `react-native-sse` 폴리필로 `EventSource` 사용
      (RN엔 내장 EventSource 없음). 페이지 진입 시 종목으로 스트림 오픈, 이탈 시 닫기
- [ ] **웹(Next.js)**: 브라우저 내장 `EventSource` 사용
- [ ] 재연결 전략(브라우저 자동 재연결 + `Last-Event-ID` 활용 검토)
- [ ] 종목 변경 UX: per-page 스트림 재오픈 방식 (현재 설계)

### 3. 배포 (Cloud Run) — `apps/realtime/deploy/README.md`
- [ ] Artifact Registry 빌드: `cloudbuild.yaml` + `_DOCKERFILE=apps/realtime/Dockerfile`
- [ ] (KIS 연동 시) 시크릿: `kis-app-key`, `kis-app-secret`
- [ ] `gcloud run deploy moneyroad-realtime` — **필수 플래그**:
      `--no-cpu-throttling --min-instances=1 --max-instances=1 --timeout=3600 --concurrency=250 --port=8080`
- [ ] mock 피드로 먼저 배포해 SSE 동작 확인 → `FEED=kis`로 전환

### 4. Phase 2 — 스케일 (동시접속 증가 시)
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

### 환경변수 (`apps/realtime/src/env.ts`)
- `FEED` = `mock` | `kis`
- `PORT`(Cloud Run 자동), `HEARTBEAT_MS`, `MOCK_INTERVAL_MS`
- `KIS_ENV` = `prod` | `paper`, `KIS_APP_KEY`, `KIS_APP_SECRET`

### 엔드포인트
- `GET /stream/quotes?symbols=005930,000660` → `event: quote` 스트림
- `GET /healthz` → `{ status, clients }`
