# RFC 0003 — 관리자 토론방 편집·삭제 + 카운트 실시간화 (discussion-room-manage-and-live-counts)

- 상태: **Draft — 설계 제안. 리뷰/결정 대기.**
- 작성일: 2026-07-23
- 범위: (1) 토론 목록·방의 **사람수·말풍선(메시지) 카운트 실시간 갱신**, (2) 관리자 **토론방 삭제**(빨간 휴지통), (3) 관리자 **토론방 편집**(연필 → 프리필 작성폼 → "저장", dirty 뒤로가기 경고). 범위 밖: WebSocket/SSE 전환(ADR 0001 — PMF 후), Expo 푸시 알림(working-charter 규칙 #2), 실시간 접속자(presence) 집계, DB 스키마 변경.
- 검증: 실제 코드(file:line) 근거. 백엔드(`updateRoom`/`deleteRoom`)는 **이미 구현되어 있음** — 본 RFC는 대부분 네이티브 UI 배선 작업.
- 관련 코드: `packages/api/src/routers/discussion.ts`, `packages/db/src/schema/discussion.ts`, `apps/native/src/screens/discuss/index.tsx`, `apps/native/src/screens/discussion-room/index.tsx`, `apps/native/src/screens/discussion-room-new/index.tsx`, `apps/native/src/components/cards.tsx`, `apps/native/src/components/icons.tsx`, `apps/native/src/utils/nav.ts`, `apps/native/src/app/(moneyroad)/discussion-room/new.tsx`.
- 참조: ADR 0001(폴링 우선), ADR 0002(암묵적 멤버십), ADR 0003(종목 바인딩), RFC 0002(관리자 뉴스 작성 — 편집/삭제 UX 선례), CONTEXT.md, working-charter.md.

---

## 1. 배경 / 문제

관리자가 토론방을 만들고 사용자들이 그 안에서 대화하는 구조는 이미 동작한다(Phase 4 완료). 그러나 실사용(에뮬레이터 2대) 검증에서 세 가지 결함이 확인됐다.

1. **카운트가 얼어붙는다.** 한쪽 기기에서 메시지를 올려도 다른 기기(및 목록 화면)에서 **말풍선 수·사람수가 0에서 안 바뀐다.** 앱을 완전히 껐다 켜야(콜드 스타트) 반영된다. → "변화가 생길 때마다 바로바로 숫자가 변해야 한다."
2. **만들어진 토론방을 삭제할 수단이 없다.** 관리자가 목록에서 방을 지울 UI가 없다.
3. **만들어진 토론방을 수정할 수단이 없다.** 방 이름·설명·종목·톤을 나중에 고칠 UI가 없다(주제를 한 번 정하면 못 바꿈).

### 팀장님 규칙과의 관계 (선행 확인)

- **삭제/수정 권한은 금지가 아니라 명시적으로 허용됨.** `CONTEXT.md:25` — "Only an **Admin** can create or edit a **DiscussionRoom** or delete other users' messages." `CONTEXT.md:8` — sentiment은 "admin may edit later." 즉 관리자 편집/삭제는 설계 의도에 부합한다.
- **백엔드는 이미 존재한다.** `discussion.ts`의 `updateRoom`(:597, adminProcedure)·`deleteRoom`(:631, adminProcedure)이 구현돼 있고, 목록/화면 배선만 없다. → **새 API·마이그레이션 불필요.** working-charter 규칙 #9(쓰기=server), #1(DB generate+migrate)에 자동 부합(스키마 변경 자체가 없음).
- **실시간은 폴링으로 한다.** ADR 0001이 SSE/WS를 PMF 이후로 미루고 폴링을 지정. 카운트 실시간화는 **폴링 범위 안에서만** 해결한다.

---

## 2. 목표 · 비목표

**목표**
- **G1** 방 안(상세) 화면에서 참여자수(사람수)가 폴링으로 실시간 갱신된다.
- **G2** 토론 목록 화면에서 각 방의 사람수·말풍선(메시지) 뱃지가 폴링으로 실시간 갱신된다(다른 기기의 변화 포함).
- **G3** 메시지 전송 성공 시 목록·방 캐시가 즉시 무효화된다(ADR 0001 #3 준수 — 현재 미준수 = 버그).
- **G4** 관리자가 목록 각 방 행에서 **삭제**(빨간 휴지통)로 방을 즉시 완전삭제한다.
- **G5** 관리자가 목록 각 방 행에서 **편집**(연필)으로 프리필된 작성폼을 열어 전 필드를 고치고 "저장"한다.
- **G6** 편집 중 변경이 있는 상태로 뒤로 가면 경고 다이얼로그가, 변경이 없으면 경고 없이 뒤로 간다.

**비목표**
- WebSocket/SSE 도입(ADR 0001 — Phase 6/PMF 후). 카운트 실시간화는 폴링만.
- Expo 푸시/단말 알림 발송(working-charter 규칙 #2). "알림"은 앱 내(in-app) 카운트 갱신으로만 해결.
- **실시간 접속자(presence) 집계.** 사람수는 ADR 0002의 "누적 참여자"(글을 1회 이상 쓴 사람 수) 의미를 유지한다. 동시접속 인원 집계는 별도 큰 작업.
- DB 스키마 변경(모든 컬럼이 이미 존재).
- 삭제 확인 다이얼로그(아래 D3 참고 — 사용자 지시로 생략).

---

## 3. 현재 동작 분석 (코드 근거)

### 3-1. 백엔드 — 이미 완비
`packages/api/src/routers/discussion.ts`:
- `createRoom`(:571, adminProcedure), **`updateRoom`(:597, adminProcedure)** — `{name?, description?, stockCode?, sentiment?}` 부분 패치, 빈 패치면 no-op, `discussion_room.updatedAt`은 `$onUpdate` 자동.
- **`deleteRoom`(:631, adminProcedure)** — `db.delete(discussionRoom)` **하드 삭제**(:634).
- 읽기: `rooms`(:194, publicProcedure), `room`(:294), `messages`(:353). 쓰기: `send`(:514, protectedProcedure) 등.
- 카운트는 상관 서브쿼리로 계산: `counts()`(:39~52) → `membersCount`(COUNT `discussion_room_member`), `repliesCount`(COUNT `discussion_message`).

`packages/db/src/schema/discussion.ts`:
- `discussionRoom`: `id, name, description, stockCode(→stockMaster, on delete set null), sentiment(enum, default neutral), createdBy(→user, on delete set null), createdAt, updatedAt`. **주제/카테고리/고정 컬럼 없음** — "주제"는 `name`+`description`에 대응.
- 자식 FK **전부 cascade**: `discussionMessage.roomId`(:57), `discussionRoomMember.roomId`(:91), `discussionRoomLike.roomId`(:108) 모두 `onDelete:"cascade"`. → **방 삭제 시 메시지·멤버·좋아요가 함께 정리되고 FK 에러 없음.**
- 참고 비대칭: 메시지는 소프트 삭제(`deletedAt`)지만 **방은 하드 삭제**.

### 3-2. 카운트가 얼어붙는 원인 (①의 근본원인)
- `apps/native/src/utils/orpc.ts:11` — QueryClient에 `defaultOptions` 없음(RQ 기본 `staleTime:0`). 하지만 staleTime은 함정이 아님 — **아무것도 refetch를 트리거하지 않는 게 문제.**
- **목록**(`discuss/index.tsx:74~75`): `roomsQuery`에 `refetchInterval` 없음. `toggleLike`/`createRoom`/`leaveRoom` onSuccess에서만 무효화. **`send`로는 무효화 안 됨.** 게다가 Discuss는 상시 마운트 탭(`(tabs)/_layout.tsx`) → `refetchOnMount` 재발화 안 함. → 뱃지 freeze.
- **상세**(`discussion-room/index.tsx`): `messagesQuery`만 `refetchInterval: POLL_INTERVAL_MS(=5000)`(:680) 폴링. `roomQuery`(:669, 참여자수 공급)는 **폴링 없음**. `send.onSuccess`는 **메시지만 무효화**(:687~688) → 참여자수 freeze.
- **ADR 0001 #3 위반**: ADR은 "send 성공 후 클라이언트는 list cache invalidate"를 요구하는데 현재 send가 목록을 무효화하지 않음. → 이건 사양 위반 버그.
- `realtime` 앱에는 discussion 관련 코드가 전혀 없음(순수 시세/뉴스 SSE) → 방/메시지 푸시 경로 없음(규칙 #2와도 일치). "알림이 안 뜬다"는 in-app 카운트 갱신으로 해결.

### 3-3. 목록 행 UI (버튼 자리)
- `apps/native/src/screens/discuss/index.tsx:139~143`에서 `<DiscussionRoomRow room onPress onToggleLike/>` 매핑. `+` FAB(:150~172)는 이미 `isAdmin` 게이트.
- `DiscussionRoomRow`(`components/cards.tsx:771~926`): 행 전체가 하나의 `<Pressable>`(onPress→방 열기). 현재 props = `{room, onToggleLike, onPress}`.
  - 헤더 줄(:834~843): 방 이름 + `room.time`(우측, `marginLeft:"auto"`). → **여기 우측이 편집/삭제 버튼 자리(D9).**
  - 푸터 카운트 줄(:862~923): 좋아요 버튼(:870~889) + `repliesCount`(:893, 말풍선) + `membersCount`(:897, 사람수) + sentiment pill.
- 아이콘: `Icon.trash` 존재(`icons.tsx:97`). **연필 아이콘 없음 → 추가 필요.** 원형 버튼 래퍼 `IconButton`(`ui.tsx:40`, `{onPress, children, size=36}`) 재사용.

### 3-4. 작성폼 (편집 재사용 대상)
- `apps/native/src/screens/discussion-room-new/index.tsx` — **plain `useState`**(react-hook-form 아님).
  - 필드: `name`(이름*, max 50), `description`(설명, max 200), `selectedStock`(종목결합, 선택, `orpc.stock.search`), `sentiment`(톤, SegmentedControl 긍정/중립/부정, default neutral). **category/고정/주제 필드 없음.**
  - 제출 버튼 "**토론방 만들기**"(:386), `canSubmit = trimmedName.length>0 && !createRoom.isPending`(:119).
  - 제출: `createRoom`(:106) `{name, description, stockCode, sentiment}`. onSuccess: `rooms.key()` 무효화 + 방 상세로 `router.replace`(:110~113).
- 라우트 `app/(moneyroad)/discussion-room/new.tsx` — **admin 게이트가 라우트에 있음**(비관리자 `<Redirect href=".../discuss"/>`). 편집 라우트도 동일 패턴 복제.
- `utils/nav.ts` — `openCreateDiscussionRoom`(:27) 있음. **`openEditDiscussionRoom` 없음 → 추가.**

---

## 4. 제안 설계

### 4-1. 데이터 모델
**변경 없음.** 모든 컬럼 존재, 마이그레이션 불필요. 사람수=누적 멤버(ADR 0002) 의미 유지.

### 4-2. API
**새 라우터 없음.** 기존 재사용:
- 삭제 → `orpc.discussion.deleteRoom({ id })` (adminProcedure, 하드+cascade).
- 편집 → `orpc.discussion.updateRoom({ id, name, description, stockCode, sentiment })` (adminProcedure, 부분 패치).
- ⚠️ **`refreshRealtimePins` 호출 금지**(RFC 0002:172 선례 — 시세/핀 전용, 토론 무관). 방 쓰기 후엔 RQ 캐시 무효화만.

### 4-3. UI

**(a) 목록 행 버튼** — `components/cards.tsx` `DiscussionRoomRow`
- props에 `onEdit?: () => void`, `onDelete?: () => void` 추가(선택). **둘 다 넘어올 때만(=관리자) 렌더.**
- 위치: 헤더 줄 우측(`room.time` 왼쪽), 순서 **편집(연필) → 삭제(빨간 휴지통)**(D9). `IconButton` 재사용, 삭제 아이콘 색상 = 위험(빨강).
- 행 전체 Pressable 안의 중첩 Pressable이므로, 버튼 탭이 행 onPress(방 열기)를 발화시키지 않도록 처리(RN 중첩 Pressable은 안쪽이 터치 소유 — 구현 시 확인).
- `icons.tsx`에 `pencil`(편집) 아이콘 추가.

**(b) 목록 화면 배선** — `screens/discuss/index.tsx`
- 이미 있는 `isAdmin`으로: `onEdit={() => nav.openEditDiscussionRoom(r.id)}`, `onDelete={() => deleteRoom.mutate({ id: r.id })}` 를 **isAdmin일 때만** 전달.
- `deleteRoom = useMutation(orpc.discussion.deleteRoom.mutationOptions({ onSuccess: () => invalidate rooms.key() }))`.
- **바로 삭제(D3): 확인 다이얼로그 없음** — 휴지통 onPress가 곧바로 `deleteRoom.mutate`.

**(c) 편집 라우트 + nav**
- `utils/nav.ts`에 `openEditDiscussionRoom(id)` 추가(라우트 이동 일원화 — 깊은 `router.push` 금지, working-charter native 규칙).
- 새 라우트 `app/(moneyroad)/discussion-room/edit/[id].tsx` — `new.tsx`의 admin Redirect 게이트 복제 + `id` param으로 작성폼 화면을 **편집 모드**로 렌더.

**(d) 작성폼 편집 모드** — `screens/discussion-room-new/index.tsx`
- optional `roomId`(라우트 param) 수용. **`roomId` 있으면 편집 모드.**
- **프리필**: `orpc.discussion.room({ id })`로 `name/description/sentiment/stockCode` 로드해 초기 상태 세팅. 종목 칩은 room이 종목 표시정보(이름/아이콘) 반환 시 그대로, 없으면 `stockCode` 기준 최소 표시(구현 시 room 출력 스키마 확인 — 아래 남은 확인).
- **헤더 타이틀**: "새 토론방"(:157) → 편집 모드 "**토론방 편집**".
- **제출 버튼**: "토론방 만들기"(:386) → 편집 모드 "**저장**".
- **dirty 추적**: 프리필 직후 초기 스냅샷 저장. `isDirty = 현재{name,description,stockCode,sentiment} ≠ 초기`. **저장 버튼은 `isDirty && name.trim() && !isPending`일 때만 활성**(변경 없으면 비활성 — G6).
- **제출 동작(편집)**: `updateRoom({ id, name, description, stockCode, sentiment })`. onSuccess: `rooms.key()` + `room({id})` 키 무효화 후 `router.back()`(온 곳=목록으로 복귀).
- 생성 모드(roomId 없음)는 **기존 동작 그대로**(변경 없음).

**(e) dirty 뒤로가기 경고** — 편집 모드 한정(G6)
- react-navigation `beforeRemove` 리스너로 제스처/헤더/안드로이드 하드웨어 back 모두 가로챔:
  - `!isDirty` → 그냥 통과.
  - `isDirty` → `e.preventDefault()` 후 `Alert.alert`:
    - 본문: **"수정한 내용이 반영되지 않았습니다. 정말 뒤로 가시겠습니까?"**
    - 버튼: **확인**(→ `navigation.dispatch(e.data.action)` 실제로 뒤로, 수정 폐기) / **취소**(→ 머무름).
  - RN `Alert`(web `alert()` 아님 — RFC 0002:231 선례, 기존 메시지삭제 `Alert.alert`(`discussion-room/index.tsx:801`) 패턴과 통일).

### 4-4. 실시간 (폴링 — ADR 0001 준수 + 목록 폴링 확장)
- **버그 수정(공통, ADR 0001 #3 준수)** — `discussion-room/index.tsx`의 `send.onSuccess`에 **`rooms.key()` + `room({id})` 키 무효화 추가**(현재 메시지만 무효화). → 내가 글 쓰면 목록 뱃지·참여자수 즉시 반영.
- **G1** — `discussion-room/index.tsx`의 `roomQuery`에 **`refetchInterval: 5000`** 추가 → 방 안 참여자수 실시간(ADR "방 화면 폴링" 부합).
- **G2** — `discuss/index.tsx`의 `roomsQuery`에 **`refetchInterval: 5000`** 추가 → 목록 뱃지 실시간(**D2 결정** — ADR "목록=수동"의 폴링 확장. SSE 아님).
- 5초 상수: `discussion-room/index.tsx:39`의 `POLL_INTERVAL_MS`와 동일값. 목록·방 공용을 위해 공유 상수로 추출 검토(매직넘버 중복 회피).

---

## 5. 결정 사항 (확정) · 남은 확인

| # | 결정 | 값 |
|---|---|---|
| D1 | 사람수 의미 | **누적 참여자**(글 1회+ 쓴 사람, ADR 0002) 유지. freeze 버그만 수정. presence 아님. |
| D2 | 목록 실시간 | **목록 `refetchInterval:5000` 추가**(폴링 확장) + send→목록/방 무효화(ADR 0001 #3 버그수정) + 방 `roomQuery` 5초 폴링. SSE/WS 미도입. |
| D3 | 삭제 확인창 | **없음 — "바로 삭제"**(사용자 명시 지시, 3회 확인). ⚠️ RFC 0002 D8(삭제 확인 다이얼로그)·기존 메시지삭제 `Alert` 선례와 **다름**. PR에서 팀장님 재검토 가능하도록 본 문서에 명시. |
| D4 | 삭제 방식 | 기존 `deleteRoom` 하드 삭제 + FK cascade(메시지·멤버·좋아요) 재사용. 새 API·마이그레이션 없음. |
| D5 | 수정 방식 | 기존 `updateRoom` 부분 패치 재사용. |
| D6 | 편집 UI | 작성폼(`discussion-room-new`) 재사용 — 편집 모드에서 프리필 + 버튼 "저장" + `updateRoom`. |
| D7 | 편집 대상 필드 | **전부**(이름·설명·종목결합·톤). 별도 '주제' 컬럼 없음 — 주제=이름/설명. |
| D8 | dirty 뒤로가기 | 변경 있으면 경고 "수정한 내용이 반영되지 않았습니다. 정말 뒤로 가시겠습니까?"(확인=폐기 후 뒤로 / 취소=머무름), 변경 없으면 바로 뒤로. 편집 모드 한정. |
| D9 | 버튼 위치·순서 | 행 **헤더 우측(시간 옆)**, **편집(연필) → 삭제(빨강 휴지통)**. admin에게만 노출. |
| D10 | 권한 | admin 전용 — 라우트 Redirect 게이트(편집) + 목록 버튼 `isAdmin` 게이트 + 백엔드 `adminProcedure`. `refreshRealtimePins` 호출 안 함. |

**남은 확인 (구현 중 코드로 확정 — 사용자 결정 아님)**
- Q-a: `orpc.discussion.room` 출력이 종목 표시정보(이름/아이콘)를 포함하는지. 포함 시 편집 폼 종목 칩 그대로 프리필, 아니면 `stock.detail`/`stock.search`로 보강하거나 `stockCode`만 표시.
- Q-b: 5초 폴링 상수 위치(각 화면 로컬 vs 공유 util). 기능 영향 없음 — 클린업 판단.

---

## 6. 마이그레이션 / 백필
**없음.** 스키마·데이터 변경 전무. `pnpm db:generate`/`db:migrate` 불필요.

---

## 7. 엣지케이스

| 상황 | 처리 |
|---|---|
| 다른 기기에서 방이 삭제됐는데 내가 그 방 상세를 보고 있음 | `roomQuery`/`messagesQuery`가 에러/빈값 → 방 상세에서 안전하게 목록으로 복귀 처리(구현 시 확인). |
| 편집 중 변경 없이 뒤로 | 경고 없이 즉시 뒤로(D8). |
| 편집에서 종목 결합 해제 | `updateRoom`에 `stockCode:null` → 스키마 `set null`(ADR 0003) 부합. |
| 두 관리자가 같은 방 동시 편집 | last-write-wins(부분 패치). 허용. |
| 비관리자가 편집/삭제 시도 | 라우트 Redirect + `adminProcedure`가 FORBIDDEN("관리자 권한이 필요합니다."). |
| 목록 5초 폴링 부하 | 방 수 소수 → 경미. 문제 시 간격 조정. |
| 사람수 의미 오해(동시접속으로 기대) | D1 — 누적 참여자. UI 문구는 기존 "참여자 N명" 유지. |

---

## 8. 구현 체크리스트 (파일별)

- `apps/native/src/components/icons.tsx` — `pencil`(편집) 아이콘 추가(trash는 이미 있음).
- `apps/native/src/components/cards.tsx` — `DiscussionRoomRow`에 `onEdit?`/`onDelete?` props + 헤더 우측 `IconButton`(연필, 빨강 휴지통), 두 props 있을 때만 렌더, 중첩 Pressable 전파 처리.
- `apps/native/src/screens/discuss/index.tsx` — `roomsQuery`에 `refetchInterval:5000`; `deleteRoom` 뮤테이션(onSuccess 목록 무효화); `isAdmin`일 때 `onEdit`(nav)·`onDelete`(바로 삭제) 전달.
- `apps/native/src/screens/discussion-room/index.tsx` — `send.onSuccess`에 `rooms.key()`+`room({id})` 무효화 추가; `roomQuery`에 `refetchInterval:5000`.
- `apps/native/src/screens/discussion-room-new/index.tsx` — `roomId`(편집 모드) 수용: `room` 프리필, 타이틀/버튼 라벨 스왑, dirty 추적으로 "저장" 활성화, `updateRoom` 제출, `beforeRemove` 경고 Alert, onSuccess 목록·방 무효화 후 `router.back()`. 생성 모드는 불변.
- `apps/native/src/app/(moneyroad)/discussion-room/edit/[id].tsx` — 신규 라우트, `new.tsx` admin Redirect 복제 + 편집 모드 렌더.
- `apps/native/src/utils/nav.ts` — `openEditDiscussionRoom(id)` 추가.
- (선택) 5초 폴링 공유 상수 추출.
- `docs/rfcs/README.md` — 0003 행 추가.
- 검증: `pnpm check` + `pnpm check-types`(native `tsc`). PR만(규칙 #6).

---

## 요약
백엔드(`updateRoom`/`deleteRoom` adminProcedure)와 스키마(전 컬럼 + FK cascade)는 **이미 완비**돼 있어, 본 RFC는 **네이티브 UI 배선 + 폴링 설정**이 전부다. ① 카운트 실시간화는 ADR 0001 폴링 안에서 `send→무효화` 버그를 고치고 목록·방에 `refetchInterval:5000`을 추가한다(D1 누적 참여자 유지, D2 목록 폴링 확장). ② 삭제는 기존 하드+cascade `deleteRoom`을 헤더 우측 빨간 휴지통에 배선(D3 바로 삭제·확인창 없음). ③ 편집은 작성폼을 재사용해 프리필→"저장"→`updateRoom`, 변경 시 dirty 뒤로가기 경고(D8). 전부 admin 전용, 스키마·마이그레이션·새 API·SSE·푸시 없음.
