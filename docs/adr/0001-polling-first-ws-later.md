# Polling-first for DiscussionRoom messages, WebSocket as MVP-validation follow-up

DiscussionRoom 메시지 전송·수신은 MVP 에서 tanstack-query `refetchInterval: 5000` 폴링 (룸 화면 안에서만, 목록 화면은 수동 리프레시) 으로 구현한다. WebSocket 이 최종 목표이지만 도입은 PMF 검증 이후로 미룬다. Cloud Run + ALB 환경의 long-lived connection 운영 비용 · sticky session · 재연결 처리 · 채널 매니저 설계는 사용 패턴 데이터가 쌓인 뒤 결정하는 편이 합리적이며, 도메인 모델(자동 join, soft delete, 권한, sentiment)은 트랜스포트와 무관하므로 두 번 흔들리지 않는다.

WebSocket 마이그레이션 마찰을 최소화하기 위해 코드에 4 가지 제약을 미리 베이킹한다:

1. **메시지 시각은 항상 서버 `created_at` 사용** — clock skew 방지, ws 시점에도 동일 정렬 기준
2. **메시지 페이지네이션은 cursor 기반** (`id` 또는 `created_at`) — ws subscribe 와 "이력 fetch + 라이브 구독" 모델 호환
3. **send mutation 성공 후 클라이언트는 list cache invalidate** (낙관적 append 금지) — ws 이벤트가 같은 자리에 메시지를 끼워넣을 수 있도록
4. **서버측 도메인 함수 `sendMessage(roomId, userId, content)` 등은 RPC 핸들러에서 분리** — ws 핸들러도 같은 함수를 호출 (코드 중복 0)

전환 트리거는 정량으로 미리 박지 않고, 운영 데이터 (동시접속 · 메시지 빈도) 로 결정한다. 폴링 코드를 "ws 로 고치는" 미래 PR 이 위 4 제약을 우연히 깨뜨리지 않도록 본 ADR 을 둔다.
