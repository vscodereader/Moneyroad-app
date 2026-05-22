# 토론 화면 — 필요 API

종목별 토론 스레드 목록 화면과, 스레드를 열었을 때의 실시간 채팅방으로 구성된다.

- 목록: `apps/native/src/screens/discuss/index.tsx`
- 채팅방: `apps/native/src/screens/thread-room/index.tsx` (`thread/[id]`)

## 1) 토론 목록 (`discuss`)

- 구성: 헤더(검색) + 탭 칩(인기/관심 종목/최신) + 스레드 행 목록 + FAB(글쓰기)
- 탭 키 `hot | watch | recent`:
  - `hot` = `likes` 내림차순, `watch` = 관심종목 코드 필터, `recent` = 최신순.

| # | 용도 | 엔드포인트 | 반환 | 소스 |
|---|---|---|---|---|
| 1 | 스레드 목록 | `discuss.threads({ tab, cursor?, limit })` | `{ items: Thread[], nextCursor }` | 🔵 DB |
| 2 | 좋아요 토글 | `discuss.toggleLike({ threadId })` | `{ liked, likes }` | 🔵 DB |
| 3 | 새 스레드 작성 | `discuss.createThread({ code, title, body, sentiment })` | `Thread` | 🔵 DB |

- `Thread` = `{ id, code, title, body, author, time, likes, replies, members,
  sentiment("up"|"down"|"neutral") }` (`apps/native/src/utils/data.ts`).
- 좋아요는 현재 클라 상태(`liked` Set)만 — 서버 토글 + 낙관적 업데이트 필요.
- FAB → 작성 화면(미구현). `code`(종목)·제목·본문·의견(긍/부/중) 입력.

## 2) 채팅방 (`thread-room`)

- 구성: 헤더(종목 스냅샷·참여자 수·공유) + 고정 토픽(스레드 본문) +
  메시지 버블 목록 + 입력 컴포저(전송)
- 메시지는 작성자 헤더(연속 메시지 묶음)·`role: "host"`("토픽 작성자")·
  `self`(내 메시지)·`sentiment`(↑매수/↓매도 의견) 표시.

| # | 용도 | 엔드포인트 | 반환 | 소스 |
|---|---|---|---|---|
| 4 | 스레드 상세 | `discuss.thread({ id })` | `Thread` + 종목 스냅샷 | 🔵 DB + 🟢 KIS |
| 5 | 메시지 목록 | `discuss.messages({ threadId, cursor? })` | `{ items: ChatMessage[], nextCursor }` | 🔵 DB |
| 6 | 메시지 전송 | `discuss.sendMessage({ threadId, text, sentiment? })` | `ChatMessage` | 🔵 DB + 🔑 Auth |
| 7 | 실시간 수신 | `discuss.stream({ threadId })` (SSE) | `ChatMessage` 스트림 | ⚡ RT |

- `ChatMessage` = `{ id, author, role?("host"), self?, sentiment?("up"|"down"),
  text, time }` (`apps/native/src/utils/data.ts`).
- 헤더 종목 스냅샷: `name`/`changePct` → 🟢 KIS `inquire_price`(또는 ⚡RT).
- `self`/`role`은 서버가 **현재 사용자(🔑 Auth)·작성자 기준**으로 판정해 내려준다.
- 현재 전송(`send`)은 로컬 배열에만 추가 → `sendMessage` 뮤테이션 + 실시간 반영.

## 실시간 설계 메모

채팅은 양방향이지만 수신은 단방향 fan-out이라, 기존 `apps/realtime`의 SSE
인프라(허브·인증 토큰)를 재사용할 수 있다. 전송은 oRPC 뮤테이션, 수신은 SSE
구독으로 분리하는 구성이 자연스럽다. (메시지량이 적으면 폴링도 가능.)

## 커뮤니티 시그널 연계
토론량·감성 집계는 시그널 `community` 타입의 입력이 된다
([signals.md](./signals.md)). `discuss.*` 데이터가 ⚙️ 엔진의 소스가 됨.

## 미정 / 결정 필요
- [ ] 실시간 채팅: SSE 재사용 vs WebSocket vs 폴링.
- [ ] 작성 권한/모더레이션·신고, 답글(`replies`) 구조(평면 vs 트리).
- [ ] `members`(참여자 수) 산정 기준(누적 vs 동시접속).
- [ ] 새 스레드 작성 화면 스펙(종목 선택·의견 태그).
