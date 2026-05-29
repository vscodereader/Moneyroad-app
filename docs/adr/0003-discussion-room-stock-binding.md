# Optional stock binding on DiscussionRoom; set null on stock delete

`discussion_room.stock_code` 는 `text references stock_master.mksc_shrn_iscd on delete set null` 로 선언한다. 컬럼은 nullable: 종목에 묶인 방 (예: 삼성전자 토론방) 과 일반 주제 방 (예: 시황 토론방) 이 같은 테이블에 공존한다. `kind` enum 같은 분기 컬럼은 두지 않는다 — `stock_code IS NULL` 체크로 동일 정보를 얻으며, 중복 진실 (denormalized truth) 을 만들지 않기 위함.

상폐 등으로 `stock_master` 에서 해당 row 가 삭제되면 토론방은 **삭제되지 않고 일반방으로 전환**된다 (`stock_code → NULL`). cascade (방 삭제) 는 과거 토론 기록 · 멤버 관계 · 좋아요를 모두 잃어 보존성을 해치고, restrict 는 운영 부담을 키운다. set null 은 UI 가 "예전엔 종목 결합 방이었으나 지금은 일반방" 으로 자연 전환하며 데이터 손실이 없다. (실제 운영에서 상폐 처리가 row 삭제가 아니라 status flag 변경으로 갈 가능성도 있으나, FK 정책은 그와 무관하게 보수적 기본값을 둔다.)

다중 종목 결합 (M:N) 은 mockup · legacy 어디에도 없으므로 별도 매핑 테이블 (`discussion_room_stock`) 은 만들지 않는다 (YAGNI). 미래에 다중 결합이 필요해지면 그때 매핑 테이블을 추가하고 `stock_code` 컬럼은 deprecate 한다.

`news.stock_code` 도 같은 정책 (`on delete set null`) 으로 선언되어 있어 도메인 전반에 정책 일관성이 있다.
