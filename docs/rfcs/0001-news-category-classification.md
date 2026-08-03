# RFC 0001 — 뉴스 피드 품질 개편 (분류 · 관련성)

- 상태: **In Review — 방향 확정(AI 미사용, 순수 키워드/규칙) · 구현 설계 확정. 리뷰/승인 대기.**
- 작성일: 2026-07-21 · 갱신: 2026-07-22
- 범위: 뉴스 탭 **분류(시장/산업/정책 + 해외/기업)** + **관련성(오탐) 드롭**. sentiment(상승/하락 색상)·관심종목 매칭은 **범위 밖(후속 별도)**.
- 검증: `moneyroad-postgres` 실데이터(검증 시점 454~467건) + 실제 코드 확인. 아래 수치는 실측(§11 재현 SQL).
- 관련 코드: `apps/realtime/src/services/news/*`, `packages/api/src/routers/news.ts`, `packages/db/src/schema/news.ts`, `apps/native/src/{screens/news,components/cards.tsx}`

---

## 1. 현상 (문제)

1. **탭 분류 오류**: **산업 / 정책**이 비어 있고, **전체 / 시장**이 사실상 동일한 내용.
2. **무관한 뉴스 유입(오탐)**: 주식과 무관한 기사가 피드에 들어옴.
3. (범위 밖·후속) **색상(톤) 오분류**: 부정적 기사가 상승(빨강/긍정)으로 표시됨 — sentiment 개선은 별도 처리.

탭 구성(`apps/native/src/screens/news/index.tsx`): `watch(관심종목) / all(전체) / industry(산업) / market(시장) / policy(정책)`.

## 2. 실제 사례 — 세 문제를 한 기사가 전부 증명

- **제목**: "삼척 송전선로 작업장서 헬기 추락…1명 경상, 조종사는 무사" → 카테고리 `시장`, 색 `빨강(긍정)`. (헬기 추락 사고, 주식 무관)

| 왜 | 원인 |
|---|---|
| 피드 유입 | 네이버 본문 검색이 `description`의 **"카만 항공우주 주식회사"** 에서 "주식" 매칭 → 오탐 |
| "시장" 분류 | `classifyCategory`가 기사 안 보고 **검색어 "주식"** 만 보고 market 부여 |
| "빨강(긍정)" | 제목에 하락 키워드 없음 → 기본값 up. "추락"은 `DOWN_KEYWORDS`에 없음 (sentiment, 범위 밖) |

## 3. 현재 동작 분석 (코드 근거)

- **탭 → 카테고리 필터** `packages/api/src/routers/news.ts:47` `categoryFilter`: all=필터없음, market=`category IN ('market','global')`, industry=`category='sector'`, policy=`category='other'`, watch=관심종목. 라벨맵(`:30`): market=시장, sector=산업, global=해외, company=기업, other=정책.
- **카테고리 저장** `packages/db/src/schema/news.ts:19`: `category = text`(단일값 1개), `tags = jsonb string[]`.
- **카테고리 결정** `collector.ts:74`: `category = ai?.category ?? classifyCategory(query)`. AI는 로컬에 키가 없어 `summarizeNews`가 항상 null(`ai.ts:30~33`) → 항상 `classifyCategory(query)` 폴백.
- **분류기** `naver.ts` `classifyCategory(query)`: **검색어(query) 문자열**만 검사, 첫 매칭 1개, 반환은 `market|sector|global|null` (**company/other 생성 불가**).
- **검색어** `collector.ts:21,27`: 활성 구독 쿼리, 없으면 기본 `"주식"` 하나뿐.

## 4. 근본 원인

1. **분류가 "검색어" 기준 + 검색어 "주식" 하나** → `classifyCategory("주식")=market` → **모든 뉴스 market**. (전체≈시장, 산업 미발동) — 실측: **467건 전부 `category='market'`**.
2. **정책(other)·기업(company) 분류기 자체가 없음** → 정책 탭 영구 공백.
3. **category 단일 값** → 한 기사가 여러 탭에 노출 불가.
4. **관련성 필터 부재 + 한글 부분문자열 오탐** → `"주식"`은 `"주식회사"`의 부분문자열. 실측 본문 `"주식회사"` 포함 **54건**(헬기 추락·골프 화보·식품 회수·인터뷰 등 무관 기사 유입·저장).

---

## 5. 결정 사항 (확정)

| # | 결정 | 근거 |
|---|---|---|
| D1 | **AI 미사용 — 순수 키워드/규칙** | 0원·결정적·외부 의존성 없음. (품질 상한·유지보수는 감수) |
| D2 | 판정 입력을 **검색어 → 기사 제목+본문** | 원인 1 해결의 핵심 |
| D3 | **market을 "증시 전반"으로 좁힘** (`주식/ETF/종목/투자`는 카테고리 신호에서 제외) | 시장 탭 ≠ 전체 탭 |
| D4 | **정책(other) 분류기 신설** | 원인 2 해결 |
| D5 | **관련성 드롭 게이트 신설**, 임계 1(덜 버림) | 원인 4 해결, 재현율 우선 |
| D6 | **멀티라벨 권장**(단, 단일 라벨 최소구현으로도 1·2·3 해결) | 걸치는 기사 여러 탭 노출로 재현율↑ |
| D7 | sentiment(색상)·관심종목 매칭은 **범위 밖(후속)** | 이번 티켓 집중 |

---

## 6. 해결 설계 — 분류 방식

### 6-1. 핵심 변경

| # | 변경 | 파일 | 효과 |
|---|---|---|---|
| A | `classifyCategory(query)` → **`classifyArticle({title, description, content})`** (기사 텍스트 기반 가중 스코어 다중 카테고리) | `naver.ts` | 문제 1·2 |
| B | **관련성 게이트 `isRelevant()`** 신설, 무관 기사 insert 전 드롭 | `naver.ts` + `collector.ts` | 문제 4 |
| C | `prepareItem`에서 A/B 호출로 교체 | `collector.ts` | 연결 |
| D | (권장) **멀티라벨** `news.categories jsonb string[]` 추가 + GIN 인덱스, `category`(단일, 하위호환) 유지 | `db/news.ts`, api/realtime | 동시 노출 |
| E | 기존 467건 **백필**(재분류) + 무관 기사 정리 | 1회성 스크립트 | 오염 교정 |

> 문제 1·2·4는 **A·B·C만으로(스키마 변경 없이, 단일 라벨)** 해결. D(멀티라벨)는 품질 향상 옵션.

### 6-2. 매칭 입력 · 정규화 · 가중치

- **입력 = 제목 + 본문(description + content)**. `content`는 크롤 실패 시 null → `description`(항상 존재)이 최소 신호.
- **정규화(매칭 전 필수)**: ① `주식회사`·`㈜`·`(주)`·`(株)`를 빈 문자열로 치환(오탐 원천 차단), ② 라틴 토큰용 소문자화.
- **필드 가중치**: **제목 히트 ×2, 본문 히트 ×1** (같은 키워드는 필드당 1회만 — 반복 인플레 방지).

### 6-3. 카테고리별 키워드 세트 (STRONG=2 / WEAK=1)

원칙: 모호·광범위 단어는 단독 STRONG 금지, 복합어(`…주`, `…증시`)로 STRONG화. WEAK는 단독 본문 1회로 라벨 불가(§6-4).

**market (시장 = 증시 전반) — 반드시 좁게**
- STRONG: 코스피, 코스닥, 증시, 주식시장, 유가증권시장, 코스닥시장, 시황, 거래대금, 공매도, 반대매매, 시가총액, 시총, 코스피200, 지수선물, 프로그램매매
- WEAK(짝 필요): 외국인, 기관, 순매수, 순매도, 수급, 주가, 지수, 급등, 급락, 반등, 상승세, 하락세
- **명시적 제외(카테고리 신호 아님)**: 주식, ETF, 레버리지, 종목, 투자, 펀드 — *현행이 이걸 market으로 삼아 전 기사를 market으로 만든 주범.* 실측 STRONG 세트면 market ≈ **100/467(21%)** ≠ 전체(100%).

**sector (산업/업종/테마)**
- STRONG: 반도체, 이차전지, 2차전지, 배터리, 바이오, 제약, 방산, 방위산업, 조선업, 원전, 원자력, 로봇, 자율주행, 전기차, 우주항공, 태양광, 디스플레이 + 복합어: 자동차주·금융주·은행주·증권주·게임주·엔터주·건설주·화학주·철강주·조선주·바이오주·제약주·방산주
- WEAK(짝 필요): 자동차, 화학, 철강, 건설, 유통, 게임, 엔터, 은행, 증권, 금융, 인공지능, 플랫폼, 인터넷, 업종, 섹터, 테마
- 실측 STRONG ≈ **58/467**. (금융/은행/증권 단독은 광범위 → WEAK; 반도체는 특정성↑ → STRONG)

**global (해외/글로벌)**
- STRONG: 뉴욕증시, 나스닥, 다우, S&P, 미국증시, 미국주식, 월가, 연준, Fed, FOMC, 서학개미, 해외증시, 해외주식, 니케이, 항셍, 상하이종합, 유럽증시, ADR
- WEAK(짝 필요): 미국, 중국, 일본, 유럽, 달러, 환율, 관세, 글로벌, 해외
- 국가명 단독은 위험 → WEAK, 복합어만 STRONG.

**other (정책/규제) — 신설**
- STRONG: 금융위, 금융위원회, 금감원, 금융감독원, 금융당국, 금융위원장, 예탁결제원, 공정위, 자본시장법, 상법 개정, 증여세, 상속세, 금투세, 양도소득세, 과세, 규제, 시정명령, 과태료, 제재, 세제
- WEAK(짝 필요): 정부, 대통령, 국회, 의원, 법안, 개정안, 정책, 여야, 당국, 대책
- 실측 STRONG ≈ **31/467**. (대통령/정책 단독은 정치 이슈로 인플레 → WEAK; 금융위/금감원/규제 → STRONG)

**company (개별 기업) — 필요시**
- STRONG: 유상증자, 유상감자, 무상증자, 자사주, 자기주식, 주주총회, 최대주주, 공개매수, 제3자배정, 3자배정, 신주 발행, 상장폐지, 자진 상폐, 액면분할, 스톡옵션, 인수합병
- WEAK(짝 필요): 실적, 영업이익, 순이익, 수주, 계약 체결, 지분, 인수, 합병, 신제품, 공시
- 강신호: **`stock_code` 매칭 시 +2**. company는 전용 탭 없음 → 멀티라벨 보조 태그(전체/관심종목 탭에서 소비).

### 6-4. 점수 공식 + 임계값

```
정규화 후 title, body(=description+" "+content) 필드 생성.
키워드 k 기여 = weight(k) × [ (title에 k 있으면 2) + (body에 k 있으면 1) ]   // 필드당 1회
score(cat) = Σ_{k∈cat} 기여(k)   // company에는 stock_code 매칭 시 +2
라벨 부여 임계 T_assign = 2
```

| 상황 | 점수 | 라벨? |
|---|---|---|
| STRONG 제목 1회 | 4 | ✅ |
| STRONG 본문 1회 | 2 | ✅ |
| WEAK 제목 1회 | 2 | ✅ |
| WEAK 본문 1회 | 1 | ❌ (단독 스침 배제) |
| WEAK 본문 2개 | 2 | ✅ |

→ **"STRONG은 어디든 1회면 인정, WEAK은 제목 1회 또는 본문 2개"**. `미국`(WEAK) 본문 1회로 global 안 되고, `외국인 순매도`(WEAK 2개)면 market 인정.

### 6-5. 단일/멀티라벨 · 우선순위

- **멀티라벨(권장)**: `T_assign(=2)` 이상 **모든** 카테고리 부여, **상위 3개 캡**. 임계 미달이면 `categories=[]`(빈 배열). **빈 배열이어도 관련성 통과 기사는 드롭 안 함 → 전체 탭에 남김**(시장 탭 좁히기의 핵심).
- **단일 라벨(스키마 무변경 최소구현)**: `primary = score 최대` 카테고리. 동점 우선순위 **other > company > sector > global > market**(market은 가장 넓은 버킷이라 최하위로 두어 다른 카테고리를 삼키지 않게). 임계 미달이면 `category=null`(전체 탭만).

---

## 7. 관련성 드롭 규칙 (덜 버리되 정확)

```
isRelevant(article):
  norm = normalize(title + " " + description + " " + content)   // 주식회사/㈜/(주)/(株) 제거 포함
  return (stock_code 존재) OR (RELEVANCE_SIGNALS 중 하나라도 norm에 존재)   // 임계 1 = 덜 버림
```

- **`RELEVANCE_SIGNALS` = 전 카테고리(STRONG∪WEAK) ∪ 일반 금융어**: 주식(제거 후 남은 것), 증권, 상장, 종목, 배당, 공시, 펀드, ETF, 레버리지, IPO, 공모주, 투자, 수익률, 자산운용, 유상증자, 자사주, 주주, 지분, 매수, 매도, 코인, 가상자산, 폭락장, 급등락, 유망주.
- **핵심 불변식: `RELEVANCE_SIGNALS ⊇ 모든 카테고리 키워드`** → **분류(§6) ⊆ 관련성.** 카테고리가 하나라도 붙는 기사는 절대 드롭 안 됨(분류/드롭 모순 차단).
- **임계 1 + 제목 불요**: 본문 어디든 신호 1개면 KEEP. (이것이 "최대한 덜 버린다"의 구현.)
- **실측**: 주식회사 제거 + 신호 1개 규칙으로 **~42/467(≈9%) 드롭**, 고정밀(골프 화보·식약처 회수·헬기·인터뷰·지자체 PR 등). 명백 오드롭 2~4건 수준.
- **드롭 위치**: `prepareItem` 완료(크롤로 content 확보) 후 **insert 직전** 판정 → 재현율 최대. (선택: 크롤 전 title+description 사전 컷으로 크롤 비용 절감, 재현율 소폭 손해.)

---

## 8. 오탐 방지 (한글 부분문자열/블랙리스트/최소신호)

1. **`주식회사`/`㈜`/`(주)`/`(株)` 선제거** — 실데이터 54건 오염 원천.
2. **`시장`(市場) vs `시장`(市長, 구청장/시장님) 충돌** → bare `시장` 미사용. 시장 신호는 `주식시장`·`증시`·`유가증권시장`만.
3. **`지수`(指數) vs 인명 `지수`** → `지수`는 market WEAK + 가급적 `코스피지수/코스닥지수`로 STRONG화.
4. **라틴 토큰 경계 매칭**: `AI/ETF/ADR/Fed/FOMC/S&P`는 단어 경계 정규식 또는 한글 대체어(`인공지능`). **정규식 리터럴은 모듈 최상위 상수로 선컴파일**(루프 내 생성 금지 — 성능 규칙).
5. **최소 신호 규칙**: WEAK 단독 본문 1회 라벨 불가 → 광범위어(미국/달러/금융/정책/대통령) 스침 무력화.
6. **블랙리스트(선택)**: `[mhn포토]`·`홀인원` 등. 관련성 게이트만으로 대부분 걸리므로 초기 도입 보류, §11 측정 후 필요 시.

---

## 9. 엣지케이스

| 케이스 | 처리 |
|---|---|
| 관련성 통과 · 카테고리 0 | `categories=[]`(단일 `category=null`). **드롭 아님** → 전체·관심종목 탭만 |
| 다중 매칭 | 멀티: 임계 이상 전부, 상위 3 캡 / 단일: 최고점 + 타이브레이크(§6-5) |
| 관련성 불통과 | insert 스킵(드롭) |
| content=null(크롤 실패) | title+description만으로 판정(description 항상 존재) |
| 반복어 인플레 | 키워드×필드당 1회 카운트 |
| AI 경로 복귀(원격에 키 존재) | `ai.category`를 `[ai.category]`로 래핑해 하위호환 |
| 동일 링크 재수집 | 기존 `filterNewItems` dedup 유지 |

---

## 10. 정밀도/재현율 · 초기 튜닝값

- **관련성 드롭 임계 = 1(superset 신호)** — 재현율 최우선(실측 드롭 9%·고정밀). 이것이 "덜 버린다"의 직접 반영.
- **분류 임계 `T_assign = 2`** — 올리면 정밀도↑/재현율↓, 내리면 교차 오염↑. 2가 "STRONG 1회 또는 WEAK 짝"의 자연 경계.
- **market STRONG 전용 + `주식/ETF/종목` 제외** = 정밀도 핵심. 실측 시장탭 21% ≠ 전체.
- **표본 편향 경고**: 현재 467건 전부 `query="주식"`이고 '레버리지 ETF 규제' 단일 사이클 쏠림 → `미국/달러/대통령/정책` 빈도 과대. 국가명 단독 배제·복합어 STRONG로 견고화. 실운영 후 재측정 필수.
- **초기값**: 필드가중 제목2/본문1, STRONG2/WEAK1, `T_assign=2`, 관련성 임계1, 멀티라벨 상위3 캡.

---

## 11. 검증 방법 (실측 · 재현 SQL)

1. **골드셋**: 467건 중 층화 ~150건 사람 라벨링(카테고리 다중 + 관련/드롭). 드롭셋 42건 + market/sector/other 각 30건.
2. **오프라인 러너**: `classifyArticle`/`isRelevant`를 임포트해 전건 적용하는 1회성 스크립트(`apps/realtime/scripts/eval-classify.ts`, `pnpm tsx`). 카테고리별 정밀/재현/F1, 드롭 정밀/재현 출력.
3. **탭 분포 sanity(재현 가능)**:
   ```sql
   WITH t AS (
     SELECT regexp_replace(coalesce(title,'')||' '||coalesce(description,'')||' '||coalesce(content,''),
                           '주식회사|㈜|\(주\)', '', 'g') AS txt FROM news)
   SELECT
     count(*) FILTER (WHERE txt ~ '코스피|코스닥|증시|유가증권시장|시황|거래대금|공매도|반대매매|시가총액|시총|코스피200') AS market,
     count(*) FILTER (WHERE txt ~ '반도체|이차전지|2차전지|배터리|바이오|제약|방산|조선업|원전|로봇|전기차|디스플레이|자동차주|금융주|은행주|게임주') AS sector,
     count(*) FILTER (WHERE txt ~ '뉴욕증시|나스닥|다우|S&P|미국증시|미국주식|월가|연준|Fed|FOMC|서학개미|해외증시|해외주식|ADR') AS global,
     count(*) FILTER (WHERE txt ~ '금융위|금감원|금융감독원|금융당국|자본시장법|증여세|상속세|금투세|과세|규제|시정명령|과태료|제재') AS other
   FROM t;
   -- 실측(2026-07-22): market 100 / sector 58 / global ~ / other 31 (총 467)
   ```
4. **판정 목표(초기)**: 드롭 정밀도 ≥95%, market 정밀도 ≥85%, sector/other 재현율 ≥70%, 시장탭/전체탭 건수비 ≤35%.
5. **튜닝 루프**: 미달 카테고리 오답 → STRONG/WEAK 이동·복합어화 → 재실행. `금융`(WEAK)·`미국`(WEAK) 우선 점검.

---

## 12. 구현 체크리스트 (파일별 · 스키마 · 백필)

**`apps/realtime/src/services/news/naver.ts`**
- 기존 `GLOBAL/SECTOR/MARKET_KEYWORDS` + `classifyCategory(query)` 제거/대체.
- 모듈 최상위 상수: `const STRIP_CORP = /주식회사|㈜|\(주\)|\(株\)/g;`, 카테고리별 `{strong, weak}`(§6-3), `RELEVANCE_SIGNALS`(§7), 라틴 경계 정규식.
- `normalize()`, `scoreCategory()`, **`classifyArticle({title,description,content,stockCode}) → {categories, scores}`**, **`isRelevant({...}) → boolean`**, (단일모드용) `pickPrimary(scores)`.
- 기존 `classifyCategory` 소비자는 collector.ts 하나뿐 → 교체 안전.

**`apps/realtime/src/services/news/collector.ts`**
- `prepareItem`: `stockCode` 계산 후 **관련성 우선** — `if (!isRelevant(...)) return null;` → 이후 분류. 반환 타입 `PreparedNews | null`.
- `collectQuery`: insert 전 `prepared.filter(Boolean)`, 빈 배열이면 조기 return.

**`packages/db/src/schema/news.ts`** — *멀티라벨 채택 시만*
- `categories: jsonb("categories").$type<string[]>().notNull().default([])` + GIN 인덱스.
- 마이그레이션: `pnpm db:generate` → `pnpm db:migrate` (**`db:push` 금지** — 규칙 #1). 단일 라벨만 채택하면 **스키마 변경 불필요**.

**`packages/api/src/routers/news.ts`**
- 단일 라벨: `categoryFilter` 변경 불필요(분류기가 sector/other/global을 실제 생성하기만 하면 현행 매핑 그대로 작동).
- 멀티라벨: `categoryFilter`를 배열 포함 검색으로 — `industry: categories @> '["sector"]'`, `market: categories ?| array['market','global']`, `policy: categories @> '["other"]'`.
- 탭 매핑: `global`(해외)은 시장 탭에 접어 넣음(현행 market∪global), `company`(기업)는 전용 탭 없음(전체/관심종목만).

**실시간 SSE** — *멀티라벨 채택 시만*: `read.ts`·`news-hub.ts::matchesFilter`를 배열 교집합 검사로, `NewsEvent`에 `categories` 추가. (단일 라벨이면 변경 없음.)

**기존 데이터 백필(467건)**
- 1회성 스크립트: 전건에 `isRelevant`/`classifyArticle` 적용 → 관련성 불통과(~42건) 삭제(사전 `pg_dump` 백업) 또는 숨김, 통과분 `category`(및 `categories`) UPDATE. *현재 전건 market이라 백필 없이는 과거 오염 잔존 → 백필 필수.*

**(선택·범위 밖 권장) 수집 다양성**: `getQueries()` 기본값 `"주식"` 1개가 재현율의 근본 제약. `news_subscription`에 `증시/코스피/반도체/2차전지/바이오/금융/정책` 시드 또는 `DEFAULT_QUERY` 배열화 → 산업/해외/정책 표본 증가. **분류기와 독립 개선**이므로 별도 티켓.

---

## 요약

근원 = (1) 판정 입력이 기사 아닌 검색어, (2) other/company 분류기 부재, (3) `주식`⊂`주식회사` 부분문자열 오탐 + 관련성 게이트 부재. 실데이터(467건 전부 market, 주식회사 54건, 무관 기사 다수 저장)로 확인됨.
해법 = **기사 텍스트 기반 가중 스코어 다중 분류기(`classifyArticle`) + superset 신호 관련성 게이트(`isRelevant`)**. market을 STRONG 전용으로 좁혀 시장탭≠전체탭(21% vs 100%), 관련성은 임계 1로 두어 9%만 고정밀 드롭. **최소 구현(A·B·C, 스키마 무변경, 단일 라벨)으로 문제 1·2·4 해결**, 멀티라벨(D)은 재현율 향상 권장 옵션.
