# Moneyroad

Moneyroad is a mobile-first investing assistant that organizes market signals, news, discussion, and account tasks around the investor's daily decision flow.

## Language

**DiscussionRoom**:
An admin-created topic space where users exchange messages. Optionally bound to a single stock (e.g., 삼성전자 토론방); rooms with no stock binding are general topics (e.g., 시황 토론방). Carries an admin-set sentiment (긍정/중립/부정, default 중립) that the admin may edit later.
_Avoid_: Thread, Topic, Forum, Channel, Chat

**Member**:
A user who has joined a DiscussionRoom. Membership is granted implicitly the first time the user sends a message in the room; the user may leave explicitly. The "참여자 N명" counter on a room reflects its current Member count.
_Avoid_: Participant, subscriber, joiner

**Admin**:
A user whose `role = 'admin'` (managed via the Better Auth admin plugin). The only role permitted to create or edit DiscussionRooms (name, description, stock binding, sentiment) and to moderate any message.
_Avoid_: Moderator, owner, host

## Relationships

- A **DiscussionRoom** may belong to zero or one stocks (optional stock binding).
- A **DiscussionRoom** contains zero or more user messages.
- A **DiscussionRoom** has zero or more **Members**.
- A **Member** belongs to exactly one user and one **DiscussionRoom** (composite identity).
- Only an **Admin** can create or edit a **DiscussionRoom** or delete other users' messages.
- A user may like a **DiscussionRoom** at most once.

## Example Dialogue

> **Dev**: "비로그인 사용자가 종목 토론방에 들어왔어. 메시지 보여줘야 해?"
> **Domain expert**: "응, 읽기는 누구나 가능해. 글을 쓰려면 로그인 + 자동으로 **Member**가 돼. 좋아요도 로그인이 필요해."

> **Dev**: "관심 종목 탭에 일반방도 노출할까?"
> **Domain expert**: "아니. 관심 종목 탭은 사용자 **Watchlist**에 있는 종목에 바인딩된 **DiscussionRoom**만 보여줘. 일반방은 인기·최신 탭에만 등장."

## Flagged Ambiguities

- UI 탭 라벨 "토론" 은 **DiscussionRoom** 영역.
- mockup 코드의 `Thread` 네이밍 (`thread-room/`, `ThreadRow`, `openThread`, `type Thread`) 은 구현 시 `DiscussionRoom` 으로 리네임.
- legacy 의 명시적 join CTA ("참여하기") 는 신규 모델에서 폐지. **Member** 발생은 첫 메시지 전송 시 자동.
