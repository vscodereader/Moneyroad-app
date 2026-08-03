# 토론 화면 — 필요 API

<!-- vscodereader 2026-07-30 수정: 기존 Thread/thread-room 설계가
DiscussionRoom/discussion-room으로 구현 완료되어 실제 도메인·경로로 변경. -->
종목별 DiscussionRoom 목록 화면과, 방을 열었을 때의 메시지 화면으로 구성된다.

- 목록: `apps/native/src/screens/discuss/index.tsx`
- 채팅방: `apps/native/src/screens/discussion-room/index.tsx`
  (`discussion-room/[id]`)

## 1) 토론 목록 (`discuss`)

- 구성: 헤더(검색) + 탭 칩(인기/관심 종목/최신) + 스레드 행 목록 + FAB(글쓰기)
- 탭 키 `hot | watch | recent | favorite`:
  - `hot` = `likes` 내림차순, `watch` = 관심종목 코드 필터, `recent` = 최신순.

| # | 용도 | 엔드포인트 | 반환 | 소스 |
|---|---|---|---|---|
| 1 | 토론방 목록 | `discussion.rooms({ tab, stockCode?, q? })` | `DiscussionRoom[]` | 🔵 DB |
| 2 | 좋아요 토글 | `discussion.toggleLike({ roomId })` | `{ liked, likesCount }` | 🔵 DB + 🔑 Auth |
| 3 | 즐겨찾기 토글 | `discussion.toggleFavorite({ roomId })` | `{ favorited }` | 🔵 DB + 🔑 Auth |

<!-- vscodereader 2026-07-30 수정: 기존 미구현이었던 좋아요·즐겨찾기·관리자
방 생성/편집 화면을 실제 서버 mutation과 native 화면 기준으로 갱신. -->
- 좋아요·즐겨찾기는 각각 `discussion_room_like`·`discussion_room_favorite`에 저장한다.
- 관리자 FAB → `discussion-room/new`; 종목·방 이름·설명·sentiment를 입력한다.
- 관리자는 기존 방을 편집하거나 삭제할 수 있다.

<!-- vscodereader 2026-07-30 수정: 기존 thread-room 경로가 discussion-room으로
리네임되어 현재 native 화면 경로와 일치하도록 변경. -->
## 2) 채팅방 (`discussion-room`)

- 구성: 헤더(종목 스냅샷·참여자 수) + 메시지 버블 목록 +
  첨부·답글을 지원하는 입력 컴포저(전송)
- 메시지는 작성자·관리자 여부·내 메시지 여부·답글·첨부·가림/삭제 상태를
  서버 응답에 따라 표시한다.

| # | 용도 | 엔드포인트 | 반환 | 소스 |
|---|---|---|---|---|
| 4 | 방 메타데이터 | `discussion.room({ id })` | `DiscussionRoom` | 🔵 DB, public |
| 5 | 메시지 목록 | `discussion.messages({ roomId, cursor?, after? })` | `{ messages, nextCursor, nextAfter }` | 🔵 DB + 🔑 Auth |
| 6 | 앵커 주변 메시지 | `discussion.messagesAround({ roomId, anchorId })` | `{ messages, nextCursor, nextAfter }` | 🔵 DB + 🔑 Auth |
| 7 | 메시지 전송 | `discussion.send({ roomId, content, ... })` | `{ id, createdAt }` | 🔵 DB + 🔑 Auth |

비로그인은 `hot`·`recent` 목록과 방 헤더/고정 토픽까지만 볼 수 있다. 검색,
`watch`·`favorite`, 좋아요·별, 메시지 읽기·쓰기는 로그인과 온보딩 완료가
필요하다. 비로그인 토론방 화면은 실제 메시지 query를 실행하지 않고 기존
`GuestOverlay`만 표시한다.

<!-- vscodereader 2026-07-30 수정: 기존 mock ChatMessage 중심 설명을
discussion.messages 서버 응답 중심으로 바꾸고, 잔존 mock은 비활성 레거시로 구분. -->
- 활성 채팅 데이터는 `discussion.messages/messagesAround`의 서버 추론 타입을
  사용한다. `apps/native/src/utils/data.ts`의 `ChatMessage`와 mock 배열은
  레거시 정적 데이터로 남아 있으며 실제 방 메시지 조회·전송에는 사용하지 않는다.
- 헤더 종목 스냅샷: `name`/`changePct` → 🟢 KIS `inquire_price`(또는 ⚡RT).
- `self`/`role`은 서버가 **현재 사용자(🔑 Auth)·작성자 기준**으로 판정해 내려준다.
<!-- vscodereader 2026-07-30 수정: 기존 로컬 배열 전송이 server의
discussion.send mutation·DB 저장·암묵 멤버십으로 구현되어 현재 동작 반영. -->
- `discussion.send`는 DB에 메시지를 저장하고 첫 전송 시 Member를 암묵 생성한다.
- 메시지 변경 후 messages/room/rooms query를 invalidate하며 낙관적 append는 하지 않는다.

## 실시간 설계 메모

<!-- vscodereader 2026-07-30 수정: 실시간 방식 미정이었던 항목 중 목록은 SSE,
메시지는 ADR 0001과 사용자 지시에 따라 5초 폴링으로 확정된 현재 구조 반영. -->
토론방 **목록 갱신**은 realtime SSE를 사용한다. 메시지 **전송**은 server oRPC
mutation, 메시지 **수신**은 5초 폴링을 유지한다. 메시지 WebSocket/SSE 전환은
PMF 이후 별도 결정으로 남긴다.

## 커뮤니티 시그널 연계
토론량·감성 집계는 시그널 `community` 타입의 입력이 된다
([signals.md](./signals.md)). `discuss.*` 데이터가 ⚙️ 엔진의 소스가 됨.

## 미정 / 결정 필요
<!-- vscodereader 2026-07-30 수정: 기존 미정이었던 모더레이션·답글·Member 기준·
작성 화면을 구현 결과로 완료 처리하고, 실제 미구현인 신고·메시지 실시간 전환만 유지. -->
- [x] 메시지 수신은 현재 5초 폴링. 목록만 SSE
- [x] 관리자 가림·삭제, 멤버 mute·차단
- [x] 답글은 `discussion_message.parent_id` 자기참조 1단계 구조
- [x] `members`는 첫 메시지 전송 시 생성되는 현재 Member 행 수
- [x] 관리자 DiscussionRoom 생성·편집 화면
- [ ] 사용자 신고 기능
- [ ] 메시지 WebSocket/SSE 전환(PMF 이후)
