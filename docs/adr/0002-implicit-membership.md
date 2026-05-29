# Implicit DiscussionRoom membership on first send

DiscussionRoom **Member** 십은 사용자가 그 방에서 첫 메시지를 전송할 때 암묵적으로 생성된다. legacy 의 명시적 "참여하기" CTA · `joinRoom` API · "비멤버는 메시지 못 봄" 가드는 신규 모델에서 폐지한다. 읽기는 누구나 (비로그인 포함) 가능, 쓰기는 로그인 + send 핸들러에서 자동 join.

이유: 새 UI mockup 에 join CTA 가 없고 "탭 → 즉시 메시지 보기" 흐름이 핵심이다. 명시 join 모델은 이 흐름과 충돌하고, 읽기 가드는 비로그인 발견성을 망가뜨린다. 그러나 "참여자 N 명" 카운트의 의미는 보존해야 하므로 `discussion_room_member` 테이블 자체는 유지하고, send 핸들러에서 `INSERT ... ON CONFLICT DO NOTHING` 으로 멤버 행을 보장한다. `leaveRoom` 은 명시적 해제로 유지한다 — "방 나가기" 는 사용자 의도가 명확한 행위이고, 한 번 참여하면 영구 멤버라는 모델은 트레이드오프가 크기 때문.

결과: 메시지 한 번이 영구적 카운트 영향을 미친다는 점은 의도된 트레이드오프이다. 대안인 "메시지 보낸 distinct user 수" 카운트는 명시 멤버십이 없을 때 의미가 약하고, 같은 사용자가 여러 번 보낸 경우의 카운트 처리 · 메시지 삭제 시 동기화 등에서 더 복잡해진다.
