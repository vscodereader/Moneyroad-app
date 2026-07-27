# RFCs (설계 제안서)

구현 **전에** 방향을 제안하고 팀 논의·합의를 받기 위한 설계 문서(설계서)를 모으는 곳.

## ADR과의 차이

- **RFC** (`docs/rfcs/`): 앞으로 어떻게 만들지 **제안**하고 합의를 구함 (미래지향, 논의용).
- **ADR** (`docs/adr/`): 이미 **결정된** 아키텍처 선택을 기록 (회고, 결정 고정).

RFC에서 합의가 끝나면, 필요 시 그 결정을 ADR로 남긴다.

## 규칙

- 파일명: `NNNN-kebab-case-제목.md` (4자리 번호, 0001부터 순번).
- 각 문서 상단에 **상태**(Draft / In Review / Accepted / Rejected / Superseded)와 **작성일**을 적는다.
- 하나의 RFC = 하나의 주제. 결정이 필요한 항목은 "결정 필요 사항" 섹션에 모은다.

## 목록

| # | 제목 | 상태 |
|---|---|---|
| [0001](0001-news-category-classification.md) | 뉴스 피드 품질 개편 (분류·관련성) | In Review |
| [0002](0002-admin-news-authoring.md) | 관리자 뉴스 작성 (다중 카테고리·핀·편집/삭제) | Draft |
| [0003](0003-discussion-room-manage-and-live-counts.md) | 관리자 토론방 편집·삭제 + 카운트 실시간화 | Draft |
| [0004](0004-discussion-moderation-sse-and-attachments.md) | 토론방 목록 SSE화 · 관리자 모더레이션 · 즐겨찾기/검색 · 첨부파일 | Draft |
| [0005](0005-attachment-save-and-open.md) | 첨부 저장·열기 (갤러리 저장 · 파일 다운로드 · 시스템 앱으로 열기) | Draft |
| [0006](0006-news-thumbnail-default-and-upload.md) | 뉴스 썸네일 (기본 이미지 · 관리자 업로드 · 머니로드 독점 칩) | Draft |
