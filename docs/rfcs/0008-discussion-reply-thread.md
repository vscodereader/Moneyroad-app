# RFC 0008 — 토론 답글 구조 + 내 글·답글 분리 (discussion-reply)

- 상태: **확정 — 결정 사항 17건 전부 종결(2026-07-28). 구현 착수 가능.**
- 작성일: 2026-07-28
- 범위: 메시지에 **답글(부모-자식) 구조**를 도입하고, "내가 쓴 글·답글" 화면을
  실제 정의(글 = 순수 글, 답글 = 답글로 단 글)에 맞게 고친다. 목록에서 항목을
  누르면 해당 토론방의 **그 메시지 위치로 이동**한다.
- 범위 밖: 답글 푸시 알림(**D11 — 제외 확정**), 메시지 수정, 신고 기능.

---

## 1. 왜 필요한가

팀장님 문서가 이 두 가지를 **의도적으로 미정으로 남겨 두셨다.**

> **미정 / 결정 필요**
> - [ ] 작성 권한/모더레이션·신고, **답글(`replies`) 구조(평면 vs 트리)**.
> — `docs/native/api/discuss.md:57`

> **미정 / 결정 필요**
> - [ ] "내가 쓴 글·답글"(`discuss.myPosts`) **제공 여부**.
> — `docs/native/api/mypage.md:46`

그 사이 `b68aad4`(팀장님, 2026-06-09)에서 **평면 구조로 먼저 구현**되었고, 문서
체크박스는 지워지지 않았다. 이 RFC는 그 미정 항목을 **트리 구조로 확정**한다.

### 현재 동작이 어긋나는 지점

| | 이름 | 실제 동작 |
|---|---|---|
| 내 글 | 내가 쓴 글 | 내가 **메시지를 남긴 토론방 목록** (글 내용이 아님) |
| 답글 | 답글 | 내가 쓴 **모든 메시지** (무엇에 대한 답인지 개념 없음) |

`discussion_message`에 `parent_id`가 없어 **"무엇에 대한 답인가"를 표현할 수단이
아예 없다.** 그래서 "아 졸려" 같은 혼잣말도 답글로 집계된다.

---

## 2. 사용자가 제시한 사양 (근거 이미지 6장)

`docs_vscodereader/request/images/` — 카카오톡·텔레그램·네이버 카페 실물 참조.

| 이미지 | 무엇을 보여주는가 |
|---|---|
| `chat_and_pushchat.jpg` | 메시지 롱프레스 메뉴에 **답장** 항목이 있는 형태 (카카오톡) |
| `chat_and_answer2.jpg` | 답글 **작성 중** — 입력창 위에 `누구님에게 답장` + 원문 미리보기 + `X` 취소 |
| `chat_and_answer_finish.jpg` | 답글 **완성** — 말풍선 안에 세로 색막대 + 원문 인용, 그 아래 내 답글 |
| `chat_and_answer.jpg` | 같은 형태(카카오톡) + 인용을 누르면 원문으로 가는 **답장으로 돌아가기** |
| `my_chat_collect.jpg` | 내 글 목록 — `제목 [답글수]` / 회색 `게시판이름 ｜ 날짜` |
| `touch_one_of_my_chat.jpg` | 목록 항목을 누르면 그 글 위치로 이동 |

### 2-1. 답글의 부모는 "직전에 누른 그 메시지"

```
안녕하세요            ← 글 (parent 없음)
 └ 반갑습니다          ← "안녕하세요"를 꾹 눌러 단 답글
    └ 저두요           ← "반갑습니다"를 꾹 눌러 단 답글
```

> "반갑습니다에 대한 답글이 저두요가 되는거야 **안녕하세요에 대한 답글이 아니라.**"

→ **트리 구조**다. 평면(모든 답글이 최상위 글에 붙음)이 아니다.

### 2-2. 글 / 답글의 정의

| | 정의 | 판별 |
|---|---|---|
| **글** | 순수하게 글만 올린 것 | `parent_id IS NULL` |
| **답글** | 꾹 눌러 답글 버튼으로 올린 것 | `parent_id IS NOT NULL` |

**글과 답글 모두 답글을 달 수 있다.**

### 2-3. 목록 행 모양 (`my_chat_collect.jpg`)

```
아 졸려
붕괴 스타레일 ｜ 2026.07.28
─────────────────────────────
냥키비리 뜬 곳 있음? [1]
붕괴 스타레일 ｜ 2026.06.02
```

- 1행: 내용 + `[답글수]` (회색). 답글이 0개면 표시하지 않음
- 2행: 회색 `토론방이름 ｜ 날짜` — **날짜까지만**(D5)

### 2-4. 누르면 그 위치로 이동

> "토론방에 글이 300개 있고 내 글이 50번째면 … 그 토론방으로 이동하고 끝이 아니라
> **내 글이 핸드폰 화면 가운데에 보이게** 이동해서 보여줘."

---

## 3. 현재 코드 상태 (구현 전 확인 완료)

### 3-1. DB — `packages/db/src/schema/discussion.ts`

```
discussion_room       id, name, description, stock_code, sentiment, created_by, …
discussion_message    id, room_id, user_id, content, deleted_at, created_at, …
                      ↑ parent_id 없음
index (room_id, id)   ← 커서 페이지네이션용. 앵커 조회에도 그대로 쓸 수 있다
```

### 3-2. 메시지 조회 — `packages/api/src/routers/discussion.ts:792`

```ts
const where = input.cursor
  ? and(eq(roomId), lt(discussionMessage.id, input.cursor))   // ← 과거 방향만
  : eq(roomId);
… .orderBy(desc(id)).limit(limit + 1)
```

**뒤(과거)로만 더 불러온다.** "특정 메시지 주변"이나 "더 최신"을 불러오는 경로가 없다.

### 3-3. 화면 — `apps/native/src/screens/discussion-room/index.tsx`

- 목록은 **`ScrollView`** (FlatList 아님, 933행). `scrollToEnd`만 쓴다
- 따라서 `scrollToIndex`를 쓸 수 없다 → 대상 행의 `onLayout` y를 재서 `scrollTo`
- `MESSAGE_LIMIT = 50`

### 3-4. 삭제는 **소프트 삭제**다 — D6/D7의 근거

`deleteMessage`(라우터 244행)는 행을 지우지 않고 `deleted_at`에 시각만 찍는다.
`deleteMessages`(대량, 331행)도 "Admin bulk **soft-delete**"라고 명시돼 있다.

→ 원문을 삭제해도 **행이 그대로 남아 있으므로 답글도 그대로 붙어 있다.** 화면에서
인용 자리만 "삭제된 글입니다"로 바꾸면 사용자가 요청한 동작이 그대로 나온다.

행이 실제로 사라지는 경우는 **토론방 삭제**뿐이고, 그때는 그 방의 메시지가 전부
`ON DELETE CASCADE`로 함께 사라진다.

### 3-5. 롱프레스 현재 동작 — `index.tsx:1482`

```
삭제·숨김된 메시지        → 아무것도 안 뜸
Admin + 남의 메시지        → [숨김][삭제] 액션시트
본인 메시지                → "메시지 삭제" Alert
비관리자 + 남의 메시지     → 아무것도 안 뜸   ← 답글 진입점이 여기 필요
```

> ⚠️ 사용자가 말씀하신 "차단과 가리기"는 실제로 **`[숨김][삭제]`**다.
> `차단하기`는 메시지가 아니라 **멤버 목록에서 멤버를 롱프레스**할 때 뜬다
> (`member-action-sheet.tsx:97`). → **D2에서 확인 완료**

### 3-6. 팀장님이 미리 박아 두신 제약 — `docs/adr/0001`

WebSocket 전환 마찰을 줄이려고 **코드에 미리 베이킹한 4가지 제약**이다. 이 RFC는
넷 다 지킨다.

| # | 제약 | 이 RFC에서 |
|---|---|---|
| 1 | 메시지 시각은 항상 서버 `created_at` | 목록 날짜도 서버 값 사용 |
| 2 | **페이지네이션은 cursor 기반(`id` 또는 `created_at`)** | `messagesAround`도 **id 커서**. §4-4의 직접 근거 |
| 3 | **send 성공 후 list cache invalidate — 낙관적 append 금지** | 답글 전송도 `invalidateQueries`만 |
| 4 | 도메인 함수 `sendMessage(...)`는 RPC 핸들러에서 분리 | `parentId`를 **라우터가 아니라 `sendMessage` 헬퍼**에 추가 |

> **#2가 "순번을 저장하지 말자"(§4-4)의 팀장님 근거다.** 순번은 offset이지 cursor가
> 아니다. 순번으로 위치를 잡는 방식은 이 제약과 정면으로 어긋나고, ws 전환 시
> "이력 fetch + 라이브 구독" 모델과도 맞지 않는다.

`docs/adr/0002`(첫 전송 시 자동 Member)도 그대로 적용된다 — 답글도 메시지이므로
`sendMessage`의 `ON CONFLICT DO NOTHING` 자동 join 경로를 똑같이 탄다.

`CONTEXT.md`의 용어 규칙(_Avoid_: Thread, Topic, Forum, Channel, Chat)에 따라
코드·문서 모두 **DiscussionRoom / 토론방 / 메시지 / 답글**로만 쓴다.

### 3-7. ⚠️ 브랜치 문제 — 아직 미결

`[숨김][삭제]` 시트는 **`main`에 없다.** `feat/rfc-0004-discussion-moderation`(PR #28)과
그 위에 쌓인 `feat/rfc-0006-news-thumbnail`(PR #30)에만 있고 **둘 다 미머지**다.

```
main → feat/rfc-0006-news-thumbnail   차이:  16 files, +4,166 / −115
  ├ discussion-room/index.tsx        +1,073   ← 이 RFC가 고쳐야 할 파일
  ├ routers/discussion.ts              +755   ← 이 RFC가 고쳐야 할 파일
  ├ admin-message-action-sheet.tsx     +101   ← [숨김][삭제]. main엔 없음
  └ 그 외 이미지·파일·멤버관리 13개 파일
```

→ **D1**

---

## 4. 설계

### 4-1. 스키마 — `parent_id` 자기참조 추가

```ts
export const discussionMessage = pgTable("discussion_message", {
  …
  /* ----(답글 부모 — RFC 0008)---- */
  // NULL = 글, 값 있음 = 답글. 부모는 "직전에 롱프레스한 그 메시지"이므로
  // 답글의 답글은 최상위 글이 아니라 그 답글을 부모로 갖는다(트리).
  parentId: integer("parent_id").references(
    (): AnyPgColumn => discussionMessage.id,
    { onDelete: "cascade" }
  ),
  /* ----(~답글 부모 여기까지)---- */
}, (table) => [
  …
  index("discussion_message_parent_idx").on(table.parentId),
]);
```

- **nullable** — 기존 메시지는 전부 `NULL` → 전부 "글"로 분류(D13)
- `onDelete: "cascade"` — 삭제가 소프트 삭제라 이 경로는 **토론방 삭제 시에만**
  탄다. 그때는 그 방 메시지가 어차피 전부 사라지므로 CASCADE가 맞다.
  **원문을 삭제해도 답글이 남는 요구(D6)는 소프트 삭제라 자동으로 충족된다.**

### 4-2. 답글 개수 `[n]` — 카운터 컬럼을 두지 않는다

팀장님이 같은 파일에 남기신 선례를 따른다:

> 인기 탭은 이 테이블을 `COUNT(*)`로 정렬한다. **비정규화 카운터는 인기 탭
> 쿼리가 느린 게 관측되기 전까지 두지 않는다**(Q4).
> — `packages/db/src/schema/discussion.ts:98-99`

목록은 최대 50행이므로 상관 서브쿼리로 충분하다. **직속 자식만 센다**(D4).

```sql
(SELECT COUNT(*) FROM discussion_message c
  WHERE c.parent_id = m.id AND c.deleted_at IS NULL)
```

→ `안녕하세요 ← 반갑습니다 ← 저두요`에서 안녕하세요는 `[1]`이다.

### 4-3. 조회 API

| 프로시저 | 변경 | 반환 |
|---|---|---|
| `discussion.messages` | `parentId` + 인용 스냅샷 추가, **양방향 커서** | 기존 + `parent`, `replyCount` |
| `discussion.messagesAround` | **신규** | 앵커 주변 (과거 N + 미래 N) |
| `discussion.myPosts` | **신규** | `parent_id IS NULL`인 내 메시지 |
| `discussion.myReplies` | 조건 변경 | `parent_id IS NOT NULL`인 내 메시지 |
| `discussion.myRooms` | **손대지 않음** | 화면에서 호출만 중단(D12) |

#### 인용 스냅샷 (`parent`)

```ts
parent: {
  id: number;
  userName: string;
  content: string;      // 마스킹 적용 후
  type: "text" | "image" | "file";
  masked: "deleted" | "blinded" | null;
} | null
```

원문이 삭제/숨김이면 `content`를 서버에서 비우고 `masked`만 내려보낸다 — 마스킹된
본문이 인용을 통해 새어 나가지 않게 한다(RFC 0004 기능5와 동일한 원칙).

#### `messagesAround(roomId, anchorId, limit)`

```sql
-- 앵커 포함 과거 방향
SELECT … WHERE room_id = ? AND id <= ? ORDER BY id DESC LIMIT 25
-- 앵커보다 최신
SELECT … WHERE room_id = ? AND id >  ? ORDER BY id ASC  LIMIT 25
```

둘을 합쳐 id 오름차순으로 반환. 기존 인덱스 `(room_id, id)`를 그대로 탄다.

#### 양방향 커서 (D15)

앵커로 진입하면 **위아래 양쪽이 모두 잘려 있다.** 기존 `cursor`(과거)에 더해
`after`(미래) 방향을 추가한다.

```ts
messages({ roomId, cursor?, after?, limit })
  cursor → id <  cursor  ORDER BY id DESC   (위로 스크롤 = 과거)
  after  → id >  after   ORDER BY id ASC    (아래로 스크롤 = 최신)
```

### 4-4. ❗ "몇 번째 글인지" DB 저장은 하지 않는다 (D10 확정)

사용자 제안:

> "글이 올라갈 때 어느 토론방인지 **몇 번째 글인지도 DB에 같이 저장**해놔야겠지?"

**저장하지 않는다.** 이유:

0. **팀장님 제약과 어긋난다.** `docs/adr/0001` #2는 "메시지 페이지네이션은
   **cursor 기반**(`id` 또는 `created_at`)"을 명시한다. 순번은 cursor가 아니라
   offset이다. 순번으로 위치를 잡으면 이 제약을 깨고, ws 전환 시 "이력 fetch +
   라이브 구독" 모델과도 맞지 않게 된다.
1. **`message.id`가 이미 영구 고유 앵커다.** `room_id`도 이미 있다. 순번을 몰라도
   `WHERE room_id=? AND id<=?`로 그 지점을 바로 집을 수 있고, 인덱스도 이미 있다.
2. **순번은 파생값이라 틀어진다.** 앞쪽 메시지가 삭제되면 뒤쪽 전체의 순번이 밀린다.
   유지하려면 메시지 하나 지울 때마다 뒤쪽 수천 행을 `UPDATE`해야 한다.
3. **"밑에서부터 n번째"는 더 심하다.** 새 글이 하나 올라올 때마다 기존 전 행의
   역순번이 전부 밀린다.

정렬 기준이 id 순서이므로 "id로 위치를 찾는 것"과 "n번째를 찾는 것"은 같은 결과를 준다.

### 4-5. 답글 작성 흐름

```
① 메시지 롱프레스
      ↓
② 액션시트  (권한별 — §4-7)
      ↓
③ 입력창 위에 인용 미리보기        ← chat_and_answer2.jpg
   ┌────────────────────────────┐
   │ ↩ 홍길동님에게 답글        ✕ │
   │   안녕하세요                 │
   └────────────────────────────┘
      ↓
④ 전송 → send({ roomId, content, parentId })
      ↓
⑤ 말풍선 안에 인용 블록 + 본문      ← §4-6
```

### 4-6. 인용 블록 디자인 — 텔레그램 방식 채택

사용자가 두 안 중 택일을 맡기셨다. **`chat_and_answer_finish.jpg`(텔레그램)** 쪽을
고른다.

```
┌──────────────────────────┐
│ ▍홍길동                   │  ← 세로 색막대(t.primary) + 작성자명 12sp/700/primary
│ ▍안녕하세요               │  ← 원문 1줄, 12sp, fgMuted, 말줄임
│                           │
│ 반갑습니다                │  ← 본문 15sp (기존 그대로)
└──────────────────────────┘
```

**왜 이쪽인가**

- 카카오 방식은 `나에게 답장` 헤더가 **한 줄을 통째로 더 먹는다.** 우리 말풍선은
  최대 폭이 좁아 세로 공간이 아깝다
- 세로 색막대는 **원글 영역과 답글 본문의 경계를 한눈에** 보여준다 — 사용자가
  요구한 "답글과 원글은 제대로 구분"에 직접 대응한다
- 미리보기(③)와 말풍선(⑤)이 **같은 컴포넌트**를 쓸 수 있다

**삭제·숨김된 원문** (D6/D7)

```
┌──────────────────────────┐
│ ▍삭제된 글입니다          │  ← 회색·기울임, 작성자명 없음
│                           │
│ 반갑습니다                │
└──────────────────────────┘
```

숨김이면 `가려진 글입니다`.

**이미지·파일 원문** (D8)

```
▍홍길동          ▍홍길동
▍사진            ▍파일 · 실적발표.pdf
```

**인용 블록 탭 → 원문으로 점프** (D16). 앵커 스크롤(§4-8)을 그대로 재사용한다.

### 4-7. 롱프레스 액션시트 — 권한별

| 상황 | 현재 | 변경 후 |
|---|---|---|
| Admin + 남의 메시지 | `[숨김][삭제]` | **`[답글][숨김][삭제]`** (D2) |
| Admin + 본인 메시지 | 삭제 Alert | `[답글][삭제]` |
| 비관리자 + 남의 메시지 | 없음 | **`[답글]`** (D3) |
| 비관리자 + 본인 메시지 | 삭제 Alert | **`[답글]`** (D3) → **D17** |
| 삭제·숨김된 메시지 | 없음 | 없음 (유지) |

> ⚠️ **D17** — D3대로면 일반 사용자가 **자기 글을 지울 수 없게 된다.** 지금 있는
> 기능이 사라지는 것이라 확인이 필요하다.

### 4-8. 앵커 스크롤

`ScrollView`라 `scrollToIndex`가 없다.

1. 목록에서 항목 탭 → `nav.openDiscussionRoom(roomId, { anchorId })`
2. `anchorId`가 있으면 `messages` 대신 `messagesAround` 사용
3. 앵커 행의 `onLayout`에서 `y`·`height` 저장
4. `scrollTo({ y: y - viewportHeight / 2 + height / 2 })` → 화면 중앙
5. **1.5초 하이라이트** 후 서서히 사라짐 (D9)
6. 위/아래로 더 스크롤하면 양방향으로 이어서 로드 (D15)

---

## 5. 영향 범위

| 파일 | 변경 |
|---|---|
| `packages/db/src/schema/discussion.ts` | `parentId` 컬럼 + 인덱스 |
| `packages/db/src/migrations/00NN_*.sql` | 신규 (컬럼 추가 — 되돌릴 수 있음) |
| `packages/api/src/routers/discussion.ts` | `send` 입력, `messages`(양방향+인용), `messagesAround`(신규), `myPosts`(신규), `myReplies` |
| `apps/native/src/screens/discussion-room/index.tsx` | 롱프레스 분기, 인용 미리보기, 앵커 스크롤, 양방향 로드 |
| `.../components/admin-message-action-sheet.tsx` | `[답글]` 추가 → 3개 |
| `.../components/reply-action-sheet.tsx` | 신규 — 비관리자용 |
| `.../components/reply-quote.tsx` | 신규 — 인용 블록 (미리보기·말풍선 공용) |
| `apps/native/src/screens/settings/pages.tsx` | `MyPosts` 목록 행 재구성 |
| `apps/native/src/utils/nav.ts` | `openDiscussionRoom`에 `anchorId` |
| `docs/native/api/discuss.md` | 미정 체크박스 해소 (**팀장님 문서 — 승인 후**) |
| `docs/native/api/mypage.md` | 동 (**팀장님 문서 — 승인 후**) |

---

## 6. 검증 계획

| 항목 | 방법 |
|---|---|
| 3단 답글 부모 관계 | 안녕하세요 → 반갑습니다 → 저두요, `parent_id` 확인 |
| 글/답글 분리 | 내 글에 "저두요"가 안 뜨고 답글에만 뜨는지 |
| 답글 개수 | 직속만 세는지 (안녕하세요 = `[1]`) |
| 삭제된 원문 인용 | 원문 삭제 후 `삭제된 글입니다` + 답글 유지 |
| 마스킹 누출 | 삭제·숨김된 원문 본문이 인용 응답에 안 실리는지 |
| 앵커 스크롤 | 메시지 100건 이상 방에서 오래된 것 탭 → 화면 중앙 + 하이라이트 |
| 양방향 로드 | 앵커 진입 후 위·아래 양쪽 스크롤 |
| 권한 | 비관리자에게 `[숨김][삭제]`가 안 보이는지 |

---

## 7. 결정 사항

### 확정 (2026-07-28)

| # | 내용 | 결정 |
|---|---|---|
| **D2** | 액션시트 3개 구성 | **`[답글][숨김][삭제]`**. "차단하기"는 멤버 롱프레스라 별개 |
| **D3** | 비관리자 롱프레스 | **`[답글]` 1개만.** 남의 글·본인 글 모두 (→ D17) |
| **D4** | `[숫자]` 범위 | **직속 답글만** |
| **D5** | 목록 2행 시각 | **날짜까지만** (`2026.07.28`) |
| **D6** | 원문 삭제 시 답글 | **답글은 남긴다.** 소프트 삭제라 자동 충족 |
| **D7** | 삭제된 원문 인용 표시 | **`삭제된 글입니다`** (숨김이면 `가려진 글입니다`) |
| **D8** | 이미지·파일 원문 인용 | `사진` / `파일 · 파일명` |
| **D9** | 앵커 이동 시 하이라이트 | **한다** (1.5초) |
| **D10** | 순번 DB 저장 | **하지 않는다** |
| **D11** | 답글 푸시 알림 | **이번 범위 제외** |
| **D12** | `myRooms` 처리 | **남겨두고 호출만 중단** |
| **D13** | 기존 메시지 분류 | **기존 데이터를 비우고 시작한다.** 사용자가 앱에서 토론방을 삭제 → `ON DELETE CASCADE`로 메시지 전부 제거. 소급 판별 문제 자체를 없앤다 |
| **D14** | 답글에도 `[n]` 표시 | **한다** |
| **D15** | 앵커 후 스크롤 | **양방향 이어서 로드** |
| **D16** | 인용 탭 → 원문 점프 | **넣는다** |
| **D1** | 어느 브랜치에서 새로 파나 | **`feat/rfc-0006-news-thumbnail` 위에 새 브랜치.** `0004 → 0006 → 0008` 3단 스택을 감수한다 |
| **D17** | 비관리자 본인 글 삭제가 사라지는 것 | **의도한 것이 맞다.** 삭제는 **관리자만** 할 수 있게 한다 |
| — | 인용 블록 디자인 | **텔레그램 방식**(세로 색막대 + 인용). 사용자가 선택 위임 |

### D13 보충 — 기존 데이터 정리

사용자가 앱에서 직접 토론방을 삭제한다. `deleteRoom`(라우터 1193행)은 **하드 삭제**라
`discussion_message.room_id ON DELETE CASCADE`가 그 방의 메시지를 전부 지운다.

> ⚠️ **로컬 DB만 해당된다.** prod DB는 조회만 하며 이 RFC 범위에서 어떤 삭제도 하지
> 않는다. prod에 남아 있는 기존 메시지는 컬럼 추가 후 전부 `parent_id = NULL`(글)이
> 되며, 그건 배포 시점에 팀장님과 따로 상의할 사항이다.

---

## 8. 열려 있는 위험

- **스택이 깊어진다** (D1-A 선택 시). `0004 → 0006 → 0008` 3단이라 앞의 PR이
  머지되지 않으면 이것도 머지할 수 없다.
- **답글 깊이 제한이 없다.** 무한히 중첩될 수 있으나 인용은 **직속 부모 1단만**
  보여주므로 화면상 문제는 없다.
- **양방향 무한 스크롤은 `ScrollView`에서 까다롭다.** 위쪽에 항목을 덧붙이면
  스크롤 위치가 튄다 — 삽입 전후 `contentSize` 차이만큼 보정해야 한다.
- **앵커 로드는 `ScrollView` 전제**다. 메시지가 수천 건인 방에서 성능이 문제되면
  `FlatList` 전환이 필요한데, 그건 이 RFC 범위 밖의 큰 변경이다.
