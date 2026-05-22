# 뉴스 화면 — 필요 API

- 화면: `apps/native/src/screens/news/index.tsx`
- 구성: 헤더 + 탭 칩(관심 종목/전체/산업/시장/정책) + 뉴스 카드 목록(AI 칩) +
  바텀시트 상세(AI 요약 + 종목 스냅샷 + 원문 미리보기 + 원문 링크)

탭 키는 `watch | all | industry | market | policy`. `watch`는 사용자의 관심
종목 코드에 해당하는 뉴스만 필터링한다.

## 필요 API

| # | 용도 | 엔드포인트 | 반환 | 소스 |
|---|---|---|---|---|
| 1 | 탭별 목록 | `news.feed({ tab, cursor?, limit })` | `{ items: NewsItem[], nextCursor }` | 🟣 AI / 외부 |
| 2 | 상세(시트) | `news.detail({ id })` | `NewsDetail` | 🟣 AI + 🟢 KIS |

- `NewsItem` = `{ id, code, category, title, source, time, thumbHint,
  sentiment("up"|"down"), ai }` (`apps/native/src/utils/data.ts`).
- `watch` 탭은 서버에서 사용자 관심종목으로 필터(🔵 DB 조인). 나머지 탭은
  `category` 기준.

### `news.detail` 반환 (`NewsDetail`)
바텀시트가 쓰는 필드 기준으로 구성한다.

```ts
{
  id, title, source, time,
  ai: string,            // 🟣 "AI 요약" (Claude 생성) — 핵심 요약 박스
  url: string,           // "원문 기사 보기" 외부 링크 (rel=noopener)
  preview?: string,      // 원문 미리보기 텍스트 (현재는 더미 문구)
  stock?: {              // 종목 스냅샷 (code가 있을 때만)
    code, name, price, change, changePct, score
  }
}
```

- `ai`(AI 요약): 🟣 자체 LLM. 시트 헤더에 "Claude가 생성" 표기.
- `stock` 스냅샷: 🟢 KIS `inquire_price`(현재가/등락) + ⚙️ 엔진(`score`).
- `url`: 외부 원문. 앱은 가공 없이 출처로 연결.

## 뉴스 원천 (수집 파이프라인)

KIS 업종/기타 카테고리에 종목 뉴스 제목 API가 마땅치 않아, 뉴스 본문/제목은
**외부 소스 수집 + 자체 저장**으로 본다. 수집 후 종목 매핑(`code`)·분류
(`category`)·감성(`sentiment`)·AI 요약(`ai`)을 붙여 DB에 적재한다.

```
[외부 뉴스] → 수집 → 종목/카테고리/감성 태깅 → 🟣 LLM 요약 → 🔵 DB → news.feed/detail
```

## 상호작용
- 탭 선택(클라 상태) → `news.feed`의 `tab` 파라미터로 재조회.
- 카드 탭 → `news.detail` 조회 후 바텀시트.
- "원문 기사 보기" → 외부 브라우저(`Linking`)로 `url` 열기.

## 미정 / 결정 필요
- [ ] 뉴스 원천 소스 확정(제공처/라이선스)과 수집 주기.
- [ ] AI 요약 생성 시점: 수집 시 사전생성(배치) vs 상세 조회 시 온디맨드.
- [ ] `preview`(원문 미리보기) 실제 제공 여부 — 현재 화면은 더미 문구.
- [ ] `sentiment`·`category` 분류 기준(룰 vs 모델).
