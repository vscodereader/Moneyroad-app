# MoneyRoad Web Landing Redesign Design

## 0. 문서 정보

- 문서 상태: 구현 전 설계 확정안
- 작성일: 2026-07-28
- 대상 서비스: `apps/web`의 루트 랜딩 페이지(`/`)
- 참고 디자인:
  - `C:\Users\user\Pictures\App_landing\App_landing_page_design1.jpg`
  - `C:\Users\user\Pictures\App_landing\App_landing_page_design2.jpg`
  - `C:\Users\user\Pictures\App_landing\App_landing_page_design3.jpg`
  - `C:\Users\user\Pictures\App_landing\App_landing_page_design4.jpg`
  - `C:\Users\user\Pictures\App_landing\App_landing_page_design5.jpg`
- 관련 기존 설계: `docs/superpowers/specs/2026-06-24-web-store-download-cta-design.md`

이 문서는 디자인과 구현 구조를 먼저 확정하기 위한 문서다. 이 단계에서는 실제 랜딩 페이지 코드를 수정하지 않는다.

---

## 1. 배경과 목표

현재 머니로드 랜딩은 시그널, 뉴스, 토론을 간단히 소개하고 스토어 다운로드로 연결한다. 기본적인 정보 전달은 가능하지만, 실제 앱이 제공하는 투자 흐름을 충분히 보여주지 못하고 다음 문제가 있다.

1. 홈 화면 한 대와 임의로 만든 시그널 카드가 중심이라 관심 종목, 가격 알림, 뉴스, 토론이 하나의 흐름으로 연결되지 않는다.
2. `PhoneFrame`, 시그널 카드, 토론 카드, 콘텐츠 데이터가 모두 `page.tsx` 안에 있어 화면 교체와 재배치가 어렵다.
3. 현재 시그널 설명은 실제 액션 기반 모델보다 넓은 범위를 단정한다. 특히 기술적·AI·이벤트·커뮤니티 신호를 모두 종합한 0~100점 표현은 현재 구현 근거와 어긋날 수 있다.
4. 뉴스 소개에서 `AI 요약`이라는 표현을 사용한다. 앱의 현재 명칭인 **`머니로드 요약`**으로 통일해야 한다.
5. 흰 배경과 회색 구간이 반복되어 머니로드의 파란 브랜드 인상이 약하다.
6. 실제 앱에는 관심 종목, 현재가·차트, 목표가 알림, 뉴스, 요약, 시그널, 종목별 토론이 있는데 랜딩은 그중 일부만 보여준다.

이번 재디자인의 목표는 다음과 같다.

- 머니로드의 기존 메인 컬러인 파란색을 유지하면서 더 선명하고 신뢰감 있는 투자 앱 인상을 만든다.
- 방문자가 첫 화면에서 `관심 종목 → 목표가 알림 → 뉴스와 요약 → 토론과 시그널 → 판단`이라는 제품 가치를 이해하게 한다.
- `App_landing_page_design5.jpg`처럼 두 대의 휴대폰이 자연스럽게 겹치는 히어로 구도를 반드시 사용한다.
- 휴대폰 외형, 휴대폰 화면 비율, 화면 내부 콘텐츠, 섹션 문구를 각각 분리해 이후 사용자가 쉽게 넣고 뺄 수 있게 한다.
- 실제 구현된 기능만 홍보하고, 수익 보장·보유자 인증·앱 내 주문처럼 오해할 표현은 사용하지 않는다.
- 기존 스토어 다운로드 링크와 투자 유의 안내를 유지한다.

### 성공 기준

방문자는 첫 10초 안에 다음 네 가지를 이해할 수 있어야 한다.

1. 원하는 종목만 관심 종목으로 모아 볼 수 있다.
2. 원하는 가격을 정해두면 도달 시점을 알 수 있다.
3. 관련 뉴스와 `머니로드 요약`으로 맥락을 빠르게 볼 수 있다.
4. 같은 종목을 보는 사용자들의 토론과 시그널을 투자 판단의 참고 정보로 사용할 수 있다.

---

## 2. 현재 프로젝트 구조 분석

### 2.1 기술 구조

- `apps/web`은 Next.js 16 App Router, React 19, Tailwind CSS v4 기반이다.
- 현재 루트 랜딩은 `apps/web/src/app/page.tsx`의 정적 Server Component다.
- 전역 스타일은 `apps/web/src/index.css`에서 `packages/ui/src/globals.css`를 가져온다.
- 공용 UI는 `@moneyroad-app/ui`에서 재사용할 수 있다.
- 랜딩의 앱 다운로드 버튼은 이미 공유 컴포넌트로 분리되어 있다.
- 새 디자인을 위해 별도의 애니메이션이나 3D 라이브러리를 추가할 필요는 없다.

### 2.2 현재 랜딩 관련 파일과 처리 방향

| 현재 파일 | 현재 역할 | 재디자인 처리 |
|---|---|---|
| `apps/web/src/app/page.tsx` | 전체 랜딩, PhoneFrame, 카드, 문구, 섹션을 한 파일에서 담당 | 섹션 조립만 남기고 얇게 만든다. |
| `apps/web/src/app/layout.tsx` | 폰트와 SEO metadata | 과장된 시그널 문구를 고치고 한국어 타이포그래피와 OG 정보를 보완한다. |
| `apps/web/src/index.css` | 공용 전역 CSS import | 랜딩 전용 토큰이 꼭 필요한 경우에만 최소한으로 추가한다. |
| `apps/web/src/components/landing/brand.tsx` | 로고와 워드마크 | 그대로 재사용한다. 필요 시 색상 variant만 추가한다. |
| `apps/web/src/components/landing/store-buttons.tsx` | App Store·Google Play 링크 | URL과 접근성을 유지하고 그대로 재사용한다. |
| `apps/web/src/components/landing/waitlist-form.tsx` | 현재 랜딩에서 사용하지 않는 사전등록 폼 | 이번 작업 범위에서는 삭제하지 않는다. |
| `apps/web/public/screens/home.png` | 현재 히어로 홈 화면 | 원본 후보로 유지하되 새 자산 폴더로 정리한다. |
| `apps/web/public/screens/news.png` | 현재 뉴스 화면 | `머니로드 요약` 표기가 맞는 최신 화면인지 확인 후 사용한다. |
| `apps/native/store-assets/**` | 실제 앱 스토어용 최신 스크린샷 | 웹에서 쓸 화면을 선별해 `apps/web/public/landing/screens`로 복사한다. 런타임에 다른 앱 폴더를 직접 참조하지 않는다. |
| `packages/ui/src/components/button.tsx` | StoreButtons가 쓰는 버튼 variant | 기존 컴포넌트를 재사용한다. 랜딩 전용 장식 때문에 공용 API를 불필요하게 늘리지 않는다. |
| `packages/ui/src/globals.css` | `#256EF4` 등 머니로드 컬러 토큰 | 기존 브랜드 토큰을 우선 사용한다. |

### 2.3 현재 사용 가능한 화면 자산

현재 웹에는 `home.png`와 `news.png` 두 장만 있다. 네이티브 앱에는 다음 스토어 스크린샷이 추가로 존재한다.

- App Store: 홈, 뉴스, 종목 상세
- Google Play: 홈, 종목 상세, 시그널, 뉴스, 마이페이지
- 원본 후보: 토론 화면 등 `apps/native/store-assets/google-play/screenshots/raw` 하위 자산

가격 알림과 토론을 랜딩에서 강조하려면 다음 중 하나가 필요하다.

1. 최신 실제 앱 화면을 캡처해 사용한다.
2. 이 설계서의 `screen-content` 컴포넌트로 랜딩 전용 화면을 코드로 재구성한다.

이번 설계의 기본 결정은 **실제 스크린샷과 코드 기반 화면 목업을 함께 사용하는 방식**이다.

- 실제 제품 신뢰가 중요한 홈·뉴스·종목 상세는 최신 스크린샷을 사용한다.
- 텍스트, 카드 수, 알림 상태를 자주 바꿔야 하는 가격 알림·토론 강조 화면은 코드 기반 목업을 사용한다.
- 두 방식 모두 동일한 `PhoneFrame`과 `PhoneScreen` 안에 넣는다.

### 2.4 이번 작업에서 건드리지 않는 영역

- `/privacy`, `/login`, `/dashboard`, `/ai`, `/todos` 페이지
- API, DB 스키마, 인증, 네이티브 앱 기능
- App Store·Google Play의 현재 다운로드 URL
- `biome.json`, `bts.jsonc`, 생성된 DB migration, lockfile 수동 편집
- 사용자가 작업 중인 `.vscode/` 등 무관한 변경

---

## 3. 실제 제품 기능과 홍보 가능 범위

랜딩 카피는 아래의 확인된 제품 범위 안에서 작성한다.

| 기능 | 코드에서 확인한 범위 | 랜딩에서 사용할 표현 |
|---|---|---|
| 현재가와 시장 흐름 | 홈·종목 상세에 시세, 지수, 차트 구조가 있다. | `종목의 현재가와 흐름을 확인하세요.` |
| 관심 종목 | 사용자 관심 종목 저장·조회와 관심 종목 기반 홈·뉴스 흐름이 있다. | `보고 싶은 종목만 모아보세요.` |
| 목표가 알림 | 이상·이하 목표가를 직접 입력하거나 현재가 대비 프리셋으로 등록한다. 가격 교차를 감지해 한 번 알리고 종목 상세로 연결하는 코드가 있다. | `원하는 가격에 도달하면 알려드려요.` |
| 뉴스 | 관심 종목 필터와 전체·시장·산업·정책 등 뉴스 분류가 있다. | `관심 종목과 시장 뉴스를 한곳에서 확인하세요.` |
| 뉴스 요약 | 앱의 현재 기본 라벨은 `머니로드 요약`이다. | 모든 사용자 노출 문구를 **`머니로드 요약`**으로 쓴다. |
| 시그널 | 매수·매도·관망 액션 기반 카드와 강도, 근거 본문 구조가 있다. | `매수·매도·관망 시그널을 참고하세요.` |
| 종목 토론 | 종목별 방, 메시지, 멤버, 검색·필터·관리 기능이 있다. | `같은 종목을 보는 사용자들의 의견과 분위기를 확인하세요.` |
| 앱 다운로드 | iOS와 Android 스토어가 공개되어 있다. | 첫 화면과 마지막 CTA에 두 스토어 버튼을 제공한다. |

### 3.1 금지하거나 완화할 표현

| 사용하지 않을 표현 | 이유 | 대체 표현 |
|---|---|---|
| `손해 보지 않게 사서 이익을 낼 때 판다` | 수익과 손실 회피를 보장하는 오해가 생긴다. | `매수·매도 판단에 필요한 정보를 한 흐름으로 정리합니다.` |
| `바로 결제하러 갈 시간` | 머니로드 안에서 주식을 주문·결제하는 것으로 오해할 수 있다. | `목표가에 도달한 시점을 알려 판단 타이밍을 놓치지 않게 돕습니다.` |
| `실제 그 주식을 산 사람들` | 현재 토론방 멤버의 보유 주식 인증 근거가 없다. | `같은 종목을 보고 있는 투자자들` |
| `뉴스가 주가를 올릴지 내려갈지 판단해 준다` | 가격 영향 예측을 확정적으로 보이게 한다. | `뉴스가 시장과 종목에 미칠 영향을 판단할 단서를 제공합니다.` |
| `AI가 정답을 알려준다` | 투자 판단 자동화·보장을 암시한다. | `머니로드 요약으로 기사의 핵심을 빠르게 파악합니다.` |
| `4가지 신호를 합친 0~100점` | 현재 액션 기반 시그널 구현보다 넓은 기능을 단정한다. | `매수·매도·관망 시그널과 근거를 한눈에 확인합니다.` |

### 3.2 가격 알림 문구 주의

가격 알림 평가·발송 코드가 존재하더라도 운영 환경, 알림 권한, 네트워크 상태에 따라 수신 조건이 달라질 수 있다. 따라서 `실시간으로 반드시 알림` 대신 `목표가에 도달하면 알려드려요`를 사용한다. 구현 단계에서는 실제 배포 환경의 알림 정책을 팀장에게 다시 확인한다.

---

## 4. 레퍼런스별 채택 요소

레퍼런스를 그대로 복제하지 않고, 머니로드에 맞는 요소만 조합한다.

### 4.1 Design 1 — 긴 호흡과 넓은 여백

좋은 요소:

- 한 화면에 하나의 메시지만 전달하는 긴 스크롤 리듬
- 큰 헤드라인과 짧은 보조 설명
- 텍스트와 제품 화면을 좌우로 번갈아 배치하는 구조
- 충분한 흰 여백과 중간중간 강한 브랜드 컬러 구간
- 제품 화면 자체를 설명의 중심으로 쓰는 방식

적용:

- 기능별 섹션은 핵심 문장 하나, 보조 문장 하나, 제품 화면 하나를 기본으로 한다.
- 데스크톱에서 이미지와 텍스트 방향을 번갈아 배치한다.
- 전체를 카드로 채우지 않고 큰 여백을 남긴다.
- 검증된 사용자 수나 수상 이력이 없으므로 통계·수상 밴드는 모방하지 않는다.

### 4.2 Design 2 — 프리미엄한 블루 히어로

좋은 요소:

- 밝고 정갈한 배경 위의 투명 오브젝트와 파란 포인트
- 제품을 크게 확대해 첫 화면의 주인공으로 만드는 방식
- 굵고 큰 타이포그래피, 간결한 키워드 태그
- 복잡한 기능을 안정감 있고 정돈된 인상으로 바꾸는 미니멀 스타일

적용:

- 히어로 뒤에 CSS radial gradient와 반투명 블루 링을 사용한다.
- 별도 3D 라이브러리나 무거운 동영상은 추가하지 않는다.
- 히어로 제목은 짧고 크게, 부가 기능은 작은 pill 형태로 정리한다.
- 유리 효과는 히어로와 일부 플로팅 카드에만 제한해 가독성을 유지한다.

### 4.3 Design 3 — 제품 랜딩의 완성도 높은 흐름

좋은 요소:

- 강한 파란 히어로와 두 대의 휴대폰 제품 샷
- 모바일과 데스크톱을 함께 고려한 레이아웃
- 기능마다 배경색과 화면 구성을 바꾸는 긴 제품 소개 흐름
- 중간 및 마지막 다운로드 CTA
- 실제 앱 화면, 말풍선, 작은 카드가 함께 떠 있는 구성

적용:

- 히어로에 겹친 두 대의 휴대폰을 사용한다.
- 각 기능 섹션에 해당 화면과 작은 상태 카드를 함께 배치한다.
- 페이지 중간에는 별도 다운로드 CTA를 반복하지 않고, sticky header와 마지막 CTA로 전환 경로를 단순화한다.
- 모바일에서는 장식보다 제품 화면과 문구가 먼저 읽히도록 재배치한다.

### 4.4 Design 4 — 브랜드 시스템과 화면 조합

좋은 요소:

- 대표 색상, 아이콘, 로고, 앱 화면을 하나의 브랜드 시스템으로 보여주는 방식
- 여러 휴대폰을 살짝 겹치고 카드·칩을 주변에 배치하는 구성
- 큰 색면과 곡선형 배경으로 섹션을 자연스럽게 구분하는 방법
- 제품 UI 컬러와 랜딩 컬러가 일치하는 점

적용:

- 머니로드의 `#256EF4`를 중심으로 앱과 랜딩의 색을 통일한다.
- 주가 상태 카드, 알림 카드, `머니로드 요약` 칩을 제품 화면 주변의 보조 요소로 쓴다.
- 큰 곡선은 한두 구간에만 사용하고, 모든 섹션을 장식하지 않는다.
- 별도의 포트폴리오식 로고·색상 설명 구간은 만들지 않는다. 방문자는 디자인 시스템이 아니라 앱 가치를 보러 오기 때문이다.

### 4.5 Design 5 — 겹친 두 대의 휴대폰과 에디토리얼 구도

좋은 요소:

- 서로 다른 각도로 겹쳐 공중에 떠 있는 두 대의 휴대폰
- 큰 여백 안에 제품을 조형적으로 배치하는 방법
- 제한된 색상과 반복되는 작은 브랜드 요소
- 화면이 여러 개여도 중심 초점이 분명한 구성

적용:

- 사용자가 명시한 대로 히어로에 겹친 두 대의 휴대폰 구도를 반드시 넣는다.
- 앞 휴대폰은 홈 또는 관심 종목, 뒤 휴대폰은 종목 상세·가격 알림 화면으로 한다.
- 앞 휴대폰을 약 `+5deg`, 뒤 휴대폰을 약 `-9deg`로 배치하되 실제 값은 화면 폭에 따라 조정한다.
- 베이지·초록 색상은 가져오지 않고 머니로드 블루 계열로 재해석한다.

### 4.6 최종 조합 원칙

- 페이지 구조: Design 1 + Design 3
- 히어로의 질감과 큰 타이포: Design 2
- 브랜드 컬러 일관성과 보조 카드: Design 4
- 겹친 두 대의 휴대폰 핵심 구도: Design 5

디자인 방향의 이름은 **`Clear Decision Flow`**로 정한다. 정보가 많은 투자 앱을 더 복잡하게 보이게 하지 않고, 사용자의 판단 흐름을 파란 길처럼 명확하게 안내한다는 의미다.

---

## 5. 비주얼 디자인 시스템

### 5.1 컬러

기존 MoneyRoad 토큰을 중심으로 다음 팔레트를 사용한다.

| 역할 | 값 | 용도 |
|---|---|---|
| Brand Primary | `#256EF4` | 로고, CTA, 핵심 단어, 활성 상태 |
| Brand Deep | `#0B50D0` | hero gradient, hover, 짙은 블루 구간 |
| Brand Soft | `#ECF2FE` | 칩, 카드 배경, 푸른 빛 확산 |
| Hero Navy | `#071B3A` | 히어로의 깊이와 하단 CTA |
| Canvas | `#FFFFFF` | 기본 배경 |
| Surface | `#F6F8FC` | 교차 섹션 배경 |
| Ink | `#111827` | 제목, 핵심 숫자 |
| Body | `#4B5563` | 본문 |
| Muted | `#8A949E` | 보조 정보 |
| Border | `#E5EAF2` | 카드와 프레임 경계 |
| Rise | `#D6212F` | 상승·매수 정보에만 제한 사용 |
| Fall | `#2563EB` | 하락·매도 정보에만 제한 사용 |

원칙:

- 파란색이 전체의 70%를 차지하게 칠하지 않는다. 흰 여백과 네이비가 파란색의 선명도를 살리게 한다.
- 상승·하락 색은 금융 데이터에만 사용한다. 일반 CTA의 의미와 섞지 않는다.
- gradient는 히어로, 가격 알림 섹션, 마지막 CTA 세 구간 이내로 제한한다.
- glass 효과를 본문 텍스트 배경에 사용하지 않는다.

### 5.2 타이포그래피

- 한국어 본문과 제목: `Noto Sans KR` 또는 배포 환경에서 안정적인 한국어 sans-serif
- 영문·숫자: 현재 `Geist`를 유지해 가격과 퍼센트의 인상을 선명하게 한다.
- 구현 시 `next/font`로 폰트를 관리하고, 한국어 글리프가 없는 `latin` 전용 폰트 하나에만 의존하지 않는다.

권장 크기:

| 용도 | Desktop | Mobile |
|---|---:|---:|
| Hero title | 64~72px / 1.05 | 42~48px / 1.12 |
| Section title | 44~52px / 1.15 | 32~38px / 1.2 |
| Hero body | 20px / 1.7 | 17px / 1.65 |
| Section body | 18px / 1.75 | 16px / 1.7 |
| Eyebrow | 13~14px / 1.4 | 12~13px / 1.4 |

### 5.3 레이아웃과 간격

- 콘텐츠 최대 폭: `1200px`
- 일반 데스크톱 좌우 여백: `32px`
- 모바일 좌우 여백: `20px`
- 섹션 세로 간격: 데스크톱 `112~144px`, 태블릿 `88~112px`, 모바일 `72~88px`
- 텍스트 열 최대 폭: `520px`
- 휴대폰 시각 요소 최대 폭: 단일 `360px`, 겹친 구성 `620px`
- 모든 섹션은 같은 12-column grid 감각을 공유한다.

### 5.4 표면과 그림자

- 카드 radius: `20~28px`
- 휴대폰 외곽 radius: 비율 기반 `44~52px`
- 일반 카드 shadow: 낮고 넓게
- 휴대폰 shadow: 배경과 분리되도록 깊고 부드럽게
- border는 완전히 없애지 않고 1px의 차가운 회색을 사용해 금융 서비스의 정돈감을 유지한다.

### 5.5 아이콘

- 기존 `lucide-react`와 `LogoMark`를 우선 재사용한다.
- 상승, 하락, 벨, 북마크, 뉴스, 대화 아이콘은 같은 stroke 두께로 통일한다.
- 아이콘을 이미지로 새로 만들 필요가 없으면 SVG/React 컴포넌트로 유지한다.

---

## 6. 페이지 전체 스토리 흐름

전체 랜딩은 `보고 싶은 것만 모으기 → 원하는 가격 정하기 → 맥락 읽기 → 사람들의 분위기 보기 → 하나의 판단 흐름으로 연결하기 → 다운로드` 순서로 진행한다.

### 6.1 Sticky Navigation

구성:

- 왼쪽: 기존 `Wordmark`
- 가운데 데스크톱 앵커: `관심 종목`, `가격 알림`, `뉴스`, `토론`
- 오른쪽: `앱 다운로드`
- 모바일: 워드마크와 다운로드 버튼만 표시한다.

동작:

- `앱 다운로드`는 기존처럼 hero의 store buttons 영역 또는 마지막 CTA로 이동한다.
- 메뉴는 실제 섹션 id를 가리키며 키보드 focus가 보여야 한다.
- 배경은 흰색 반투명과 blur를 사용하되 텍스트 대비를 확보한다.

### 6.2 Hero — 두 대의 휴대폰

목표: 첫 화면에서 `관심 종목 + 목표가 알림 + 뉴스 요약`이 한 앱 안에 있다는 것을 보여준다.

카피:

- Eyebrow: `관심 종목부터 목표가 알림까지`
- H1: `보고 싶은 종목만,` / `놓치고 싶지 않은 순간까지.`
- 본문: `현재가와 차트, 관심 종목 뉴스, 머니로드 요약, 목표가 알림과 토론을 한 흐름으로 확인하세요.`
- 보조: `iOS와 Android에서 바로 시작할 수 있어요.`
- CTA: 기존 `StoreButtons`

비주얼:

- 배경은 `Hero Navy → Brand Primary` 계열의 깊은 블루 gradient다.
- 텍스트는 왼쪽, 두 대의 휴대폰은 오른쪽에 배치한다.
- 앞 휴대폰: 홈/관심 종목 화면
- 뒤 휴대폰: 종목 상세/목표가 설정 화면
- 주변 플로팅 카드:
  - `삼성전자 목표가 도달`
  - `머니로드 요약`
  - `관심 종목 뉴스 3건`
- Design 2를 참고한 투명 블루 링과 광원을 뒤에 둔다.
- Design 5처럼 두 휴대폰의 각도와 높이를 달리한다.
- 모바일에서는 두 대를 유지하되 폭을 줄이고, 뒤 휴대폰의 약 35~45%만 보이게 해 가로 overflow를 막는다.

### 6.3 Capability Strip — 검증된 기능 요약

Design 1의 통계 구간 역할을 대신하지만, 검증되지 않은 수치는 쓰지 않는다.

4개 항목:

1. `관심 종목만 모아보기`
2. `원하는 목표가 알림`
3. `뉴스와 머니로드 요약`
4. `종목별 시그널·토론`

데스크톱에서는 한 줄, 모바일에서는 2×2 grid로 보여준다. 각 항목에는 작은 아이콘과 한 줄 설명만 둔다.

### 6.4 Feature 1 — 관심 종목과 현재가

- Section id: `watchlist`
- Eyebrow: `관심 종목`
- 제목: `내가 보는 종목만, 더 빠르게.`
- 본문: `관심 종목을 등록하면 현재가와 흐름, 관련 뉴스와 시그널을 한곳에서 이어서 확인할 수 있어요.`
- 보조 bullet:
  - `관심 종목 중심의 홈 화면`
  - `종목 상세의 현재가와 차트`
  - `관련 뉴스와 시그널 바로 연결`

비주얼:

- 실제 홈 화면을 큰 휴대폰 한 대에 보여준다.
- 옆에는 관심 종목 row 2~3개를 코드 기반 카드로 띄운다.
- 숫자가 과도하게 많아 보이지 않도록 카드 하나만 강하게, 나머지는 흐리게 처리한다.
- 배경은 흰색, 매우 옅은 파란 원형 면을 화면 뒤에 둔다.

### 6.5 Feature 2 — 목표가 알림

- Section id: `price-alert`
- Eyebrow: `목표가 알림`
- 제목: `가격을 정해두면, 도달하는 순간 알려드려요.`
- 본문: `매수 또는 매도를 고민하는 가격을 미리 정해두세요. 목표가에 도달하면 다시 종목을 확인할 시점을 놓치지 않도록 알려드려요.`
- 보조 bullet:
  - `현재가 기준 빠른 가격 설정`
  - `원하는 가격 직접 입력`
  - `알림에서 종목 상세로 바로 이동`

비주얼:

- 진한 블루 배경에 흰색 가격 알림 화면을 배치한다.
- 앞에는 목표가 설정 화면, 뒤에는 `목표가 도달` 알림 카드가 나타난다.
- 주문, 결제, 자동 매매 버튼은 그리지 않는다.
- 알림 UI는 실제 앱에서 지원하는 `이상`·`이하` 조건을 보여준다.

### 6.6 Feature 3 — 뉴스와 머니로드 요약

- Section id: `news`
- Eyebrow: `종목 뉴스`
- 제목: `뉴스는 모으고, 핵심은 머니로드 요약으로.`
- 본문: `관심 종목과 시장 뉴스를 한곳에서 보고, 긴 기사는 머니로드 요약으로 핵심부터 확인하세요. 가격에 영향을 줄 수 있는 배경을 더 빠르게 살펴볼 수 있어요.`
- 보조 bullet:
  - `관심 종목 뉴스만 모아보기`
  - `시장·산업·정책 뉴스 탐색`
  - `원문 출처로 이어지는 구조`

필수 명칭 규칙:

- 제목, 칩, alt text, metadata, 화면 목업 어디에서도 `AI 요약`을 사용자 노출 문구로 사용하지 않는다.
- 정확히 **`머니로드 요약`**으로 쓴다.
- 실제 독점 기사에만 `머니로드 독점`을 사용하고 일반 요약과 섞지 않는다.

비주얼:

- 최신 뉴스 화면 스크린샷을 휴대폰 안에 사용한다.
- 휴대폰 옆에 큰 기사 카드와 `머니로드 요약` 칩을 별도 컴포넌트로 띄운다.
- 썸네일은 실제 자산을 사용하고, 없는 경우 앱에서 정한 머니로드 기본 썸네일을 사용한다.
- 이 섹션은 밝은 `Surface` 배경으로 전환해 뉴스 카드가 잘 보이게 한다.

### 6.7 Feature 4 — 종목별 토론

- Section id: `discussion`
- Eyebrow: `종목 토론`
- 제목: `숫자만으로 부족할 때, 같은 종목을 보는 사람들의 분위기까지.`
- 본문: `종목별 토론에서 다양한 의견과 대화 흐름을 확인하세요. 추가 매수나 매도를 결정하는 정답이 아니라, 시장 심리를 살펴보는 하나의 참고 정보가 됩니다.`
- 보조 bullet:
  - `종목별 대화방 탐색`
  - `실시간에 가까운 대화 흐름`
  - `관리 기능이 적용된 커뮤니티`

비주얼:

- 종목 토론방 화면을 휴대폰 한 대에 배치한다.
- 메시지 말풍선 2~3개가 휴대폰 바깥으로 연결되는 듯한 구성을 쓴다.
- `실제 보유자`, `보유 인증`이라는 표현은 사용하지 않는다.
- 사용자 아바타는 실존 인물 사진 대신 이니셜 또는 추상 그래픽을 사용한다.

### 6.8 Feature 5 — 시그널과 판단 흐름

- Section id: `signals`
- Eyebrow: `매수 · 매도 · 관망 시그널`
- 제목: `흩어진 정보가, 하나의 판단 흐름으로.`
- 본문: `현재가를 확인하고, 시그널의 방향과 근거를 읽고, 뉴스와 토론으로 맥락을 더하세요. 머니로드는 결정을 대신하지 않고 필요한 정보를 이어줍니다.`

비주얼:

- 0~100점 원형 점수와 4개 소스 종합 그래픽은 제거한다.
- 실제 앱 모델에 맞춰 `매수`, `매도`, `관망` 카드 3개를 계단식으로 배치한다.
- 카드에는 종목명, 시그널 방향, 강도, 짧은 근거만 보인다.
- 기술적 지표 외 AI·이벤트·커뮤니티가 모두 실데이터로 제공되는 것이 확인되기 전에는 4개 소스를 한꺼번에 홍보하지 않는다.

### 6.9 How It Works — 투자 확인 루틴

제목: `복잡한 시장 확인을, 하나의 루틴으로.`

4단계:

1. `관심 종목을 담아요` — 보고 싶은 종목을 중심으로 화면을 정리한다.
2. `목표 가격을 정해요` — 매수·매도를 다시 검토할 가격을 설정한다.
3. `뉴스와 시그널을 확인해요` — 머니로드 요약과 시그널 근거로 맥락을 파악한다.
4. `토론까지 참고해 판단해요` — 같은 종목을 보는 사람들의 의견을 참고해 스스로 결정한다.

표현:

- 데스크톱은 좌우로 이어지는 road line 형태다.
- 모바일은 세로 timeline으로 바꾼다.
- 단계 사이 선은 MoneyRoad 로고의 우상향 선에서 가져오되, 수익 상승을 보장하는 그래프로 보이지 않게 단순한 경로로 표현한다.

### 6.10 Final CTA

- 배경: `Hero Navy`와 `Brand Primary`의 짙은 gradient
- 제목: `내 종목을 보는 더 선명한 방법, 머니로드.`
- 본문: `App Store와 Google Play에서 지금 시작하세요.`
- CTA: 기존 `StoreButtons variant="onDark"`
- 비주얼: 앱 아이콘과 작은 알림·뉴스·토론 아이콘이 한 방향으로 이어지는 road motif

### 6.11 Footer

유지:

- `Wordmark`
- 개인정보 처리방침 링크
- 저작권
- 투자 유의 안내

수정할 투자 유의 문구:

`머니로드가 제공하는 시세, 시그널, 뉴스 요약과 커뮤니티 정보는 투자 판단을 돕기 위한 참고 정보입니다. 매매를 권유하거나 거래를 대신하지 않으며, 모든 투자 판단과 책임은 투자자 본인에게 있습니다.`

---

## 7. 컴포넌트와 파일 분리 설계

사용자가 요구한 `휴대폰 모양`, `휴대폰 비율의 화면`, `화면 안의 교체 가능한 콘텐츠`를 다음처럼 완전히 분리한다.

```text
PhoneStack
├── PhoneFrame
│   └── PhoneScreen
│       └── HomeScreenContent 또는 실제 Image
└── PhoneFrame
    └── PhoneScreen
        └── PriceAlertScreenContent 또는 실제 Image
```

### 7.1 제안 파일 구조

```text
apps/web/src/app/
├── layout.tsx
└── page.tsx

apps/web/src/components/landing/
├── brand.tsx                         # 기존 로고/워드마크
├── store-buttons.tsx                 # 기존 스토어 버튼
├── landing-content.ts                # 섹션 문구, bullet, 화면 카드 데이터
├── landing-navigation.tsx
├── landing-footer.tsx
├── device/
│   ├── phone-frame.tsx               # 휴대폰 외형만
│   ├── phone-screen.tsx              # 휴대폰 화면 비율과 clipping만
│   └── phone-stack.tsx               # 두 대 겹침/각도/반응형 배치만
├── screen-content/
│   ├── home-screen-content.tsx       # 관심 종목/홈 목업 내용
│   ├── stock-screen-content.tsx      # 종목 상세 목업 내용
│   ├── price-alert-screen-content.tsx
│   ├── news-screen-content.tsx
│   ├── discussion-screen-content.tsx
│   └── signal-screen-content.tsx
├── floating/
│   ├── price-reached-card.tsx
│   ├── news-summary-card.tsx
│   └── discussion-message-card.tsx
└── sections/
    ├── hero-section.tsx
    ├── capability-strip.tsx
    ├── watchlist-section.tsx
    ├── price-alert-section.tsx
    ├── news-section.tsx
    ├── discussion-section.tsx
    ├── signal-section.tsx
    ├── how-it-works-section.tsx
    └── download-cta-section.tsx

apps/web/public/landing/
├── screens/
│   ├── home.png
│   ├── stock.png
│   ├── news.png
│   ├── signals.png
│   └── discussion.png
├── thumbnails/
│   └── moneyroad-default-news.png
└── og/
    └── moneyroad-landing.png
```

프로젝트 규칙에 따라 re-export만 하는 barrel `index.ts` 파일은 만들지 않는다.

### 7.2 각 파일의 책임

#### `phone-frame.tsx`

- 검은 외곽 shell, 테두리, 카메라/스피커 영역, 외곽 shadow만 담당한다.
- 화면 내용과 비율을 알지 않는다.
- `children`, `className`, `aria-label` 또는 장식 여부만 받는다.
- 특정 iPhone·Galaxy 상표를 그대로 복제하지 않는 중립적인 device frame을 사용한다.

#### `phone-screen.tsx`

- `aspect-ratio`, overflow clipping, 내부 배경과 safe-area만 담당한다.
- 기본 비율은 최신 스마트폰에 가까운 `390 / 844`로 한다.
- 실제 `<Image>`와 React 화면 콘텐츠를 모두 children으로 받을 수 있게 한다.
- 화면 내부를 바꿔도 phone shell 코드는 바뀌지 않는다.

#### `phone-stack.tsx`

- 앞·뒤 휴대폰의 겹침, 회전, 크기, z-index와 반응형 위치만 담당한다.
- `primary`, `secondary`, 선택적 floating cards slot을 받는다.
- desktop, tablet, mobile 배치를 한곳에서 제어한다.

#### `screen-content/*.tsx`

- 휴대폰 안에 보이는 실제 페이지 모양만 담당한다.
- 각 화면은 카드 배열이나 메시지 배열을 props로 받아 항목을 쉽게 추가·삭제할 수 있게 한다.
- 외곽 휴대폰 frame의 padding, shadow, 회전을 알지 않는다.
- 예시 데이터는 `landing-content.ts`에 두고 컴포넌트 내부에 직접 박아 넣지 않는다.

#### `landing-content.ts`

- 사용자 노출 문구와 목업용 배열의 단일 출처다.
- JSX와 스타일을 넣지 않는다.
- 섹션 순서, 제목, 설명, bullet, anchor id, 화면 카드 데이터가 들어간다.
- `AI 요약` 같은 금지 문구가 여러 파일에 복제되지 않게 한다.
- 화면의 관심 종목 row나 토론 메시지를 넣고 뺄 때 이 파일의 배열만 수정할 수 있게 한다.

#### `sections/*.tsx`

- 각 섹션의 레이아웃과 해당 device/screen-content 조합만 담당한다.
- 공통 텍스트 패턴이 반복되면 `feature-showcase` 같은 작은 로컬 컴포넌트를 만들 수 있지만, 서로 다른 시각 구성을 억지로 하나의 거대한 variant 컴포넌트로 합치지 않는다.

#### `page.tsx`

- 각 섹션을 순서대로 import해 조립만 한다.
- 화면 데이터, 목업 카드, device CSS를 직접 정의하지 않는다.
- 기본적으로 Server Component를 유지한다.

### 7.3 콘텐츠 교체 예시

예를 들어 뉴스 목업에서 기사 하나를 빼려면 `landing-content.ts`의 `newsPreviewItems` 배열에서 항목을 제거한다. 휴대폰의 외곽이나 뉴스 화면 레이아웃은 수정할 필요가 없다.

실제 스크린샷을 코드 기반 목업으로 교체할 때도 다음 구조만 바뀐다.

```tsx
<PhoneFrame>
  <PhoneScreen>
    <NewsScreenContent items={newsPreviewItems} />
  </PhoneScreen>
</PhoneFrame>
```

또는

```tsx
<PhoneFrame>
  <PhoneScreen>
    <Image alt="머니로드 뉴스 화면" fill src="/landing/screens/news.png" />
  </PhoneScreen>
</PhoneFrame>
```

### 7.4 공용 UI 재사용 기준

- `StoreButtons`, `Wordmark`, shared button variants는 재사용한다.
- device mockup과 marketing section은 웹 랜딩에서만 쓰므로 `apps/web/src/components/landing`에 둔다.
- native와 web에서 모두 쓸 실제 공용 UI가 생길 때만 `packages/ui/src/components`로 올린다.
- 디자인 편의를 위해 공용 Button API에 랜딩 전용 shadow나 회전 props를 추가하지 않는다.

---

## 8. 반응형 설계

### Desktop — 1200px 이상

- hero는 5:7 비율의 텍스트/폰 영역 2-column이다.
- 휴대폰 두 대가 완전히 보이고 floating cards도 최대 3개까지 표시한다.
- 기능 섹션은 텍스트와 제품 화면을 좌우 교차한다.
- navigation anchor를 모두 표시한다.

### Tablet — 768~1199px

- hero는 텍스트와 제품 비주얼을 세로로 쌓거나 6:6 grid로 유지한다.
- 휴대폰 두 대는 유지하되 floating cards를 1~2개로 줄인다.
- section gap과 title 크기를 줄인다.
- navigation 가운데 anchor는 공간에 따라 숨긴다.

### Mobile — 360~767px

- hero 카피와 store buttons를 먼저 보여주고, 휴대폰 stack을 아래에 배치한다.
- store buttons는 세로로 쌓는다.
- 뒤 휴대폰은 일부만 보이게 하되 두 대가 겹친다는 인상은 유지한다.
- 섹션은 항상 `문구 → 화면` 순서다.
- capability strip은 2×2다.
- how-it-works는 세로 timeline이다.
- floating card는 1개만 남기고 나머지는 숨겨 화면이 복잡해지지 않게 한다.
- 최소 360px에서 가로 스크롤이 없어야 한다.

---

## 9. 움직임과 상호작용

원칙은 `제품 이해에 도움되는 작은 움직임만`이다.

- hero phone stack: 첫 진입 시 `opacity + translateY`의 짧은 등장
- floating cards: 6~8초의 매우 느린 상하 부유, 각각 다른 delay
- section media: viewport 진입 시 12~20px 정도의 짧은 이동
- card hover: desktop pointer 환경에서만 2~4px 상승
- navigation anchor: smooth scroll

제약:

- 애니메이션을 위해 새 라이브러리를 추가하지 않는다.
- CSS animation과 transition으로 구현한다.
- `prefers-reduced-motion: reduce`에서는 부유, scroll animation, smooth scroll을 끈다.
- 화면 캡처 안의 숫자를 자동으로 계속 바꾸지 않는다.
- 투자 앱에서 불안감을 줄 수 있는 빠른 깜박임, 과도한 ticker motion을 사용하지 않는다.

---

## 10. 접근성

- heading은 페이지당 `h1` 하나, 섹션은 순서대로 `h2`, 카드 제목은 `h3`를 사용한다.
- 텍스트가 들어간 이미지는 동일 내용을 주변 실제 텍스트로 제공한다.
- 정보 전달용 앱 화면에는 구체적인 alt를 쓴다.
- 주변 설명과 같은 내용을 반복하는 장식용 phone mockup은 `aria-hidden="true"`로 처리한다.
- 상승·하락, 매수·매도는 색만으로 구분하지 않고 텍스트와 아이콘을 함께 사용한다.
- 모든 link와 button은 키보드 focus ring이 보여야 한다.
- body text 대비는 WCAG AA 이상을 목표로 한다.
- 200% 확대에서도 콘텐츠가 겹치거나 잘리지 않아야 한다.
- store link는 새 탭 동작과 목적이 aria-label로 분명해야 한다.

---

## 11. 성능

- 첫 화면의 앞 휴대폰 핵심 이미지만 `priority`를 사용한다.
- 뒤 휴대폰과 아래 섹션 이미지는 lazy load한다.
- 모든 raster 이미지는 표시 크기에 맞는 해상도로 리사이즈하고 필요 시 WebP/AVIF를 사용한다.
- `next/image`의 `sizes`를 desktop/tablet/mobile에 맞게 지정한다.
- hero 장식은 CSS gradient/SVG로 만들고 거대한 투명 PNG를 추가하지 않는다.
- 실제 스토어 스크린샷을 그대로 1200px 이상으로 전송하지 않고 표시 폭에 맞춰 최적화한다.
- 기본 랜딩을 Server Component로 유지한다.
- 단순 reveal을 위해 전체 페이지를 Client Component로 바꾸지 않는다.
- 새 3D, carousel, animation dependency를 추가하지 않는다.

---

## 12. SEO와 공유 정보

현재 metadata는 시그널 4종과 0~100점을 단정하고 Open Graph 이미지가 없다. 재디자인 시 다음으로 고친다.

### 제안 title

`머니로드 — 관심 종목·목표가 알림·뉴스를 한곳에서`

### 제안 description

`관심 종목의 현재가와 뉴스, 머니로드 요약, 매수·매도·관망 시그널과 종목 토론을 한 흐름으로 확인하세요. 원하는 가격에 도달하면 다시 확인할 시점도 알려드립니다.`

### 추가 항목

- canonical URL: `https://moneyroad.ai.kr/`
- Open Graph 이미지: 겹친 두 대의 휴대폰을 활용한 `1200×630`
- Twitter/X card 이미지
- `SoftwareApplication` JSON-LD
  - applicationCategory: FinanceApplication
  - operatingSystem: iOS, Android
  - 실제 스토어 URL
- 검증되지 않은 rating, reviewCount, downloadCount는 넣지 않는다.

---

## 13. 자산 제작 및 관리 규칙

1. 실제 앱 스크린샷은 최신 앱 버전에서 다시 캡처한 것을 우선한다.
2. 스크린샷 안에 `AI 요약`이 보이면 사용하지 않고 `머니로드 요약`이 적용된 최신 화면으로 교체한다.
3. 개인정보, 실제 사용자 이름, 실제 채팅 내용이 보이는 화면은 사용하지 않는다.
4. 목업 데이터는 삼성전자 등 예시 종목을 사용할 수 있지만 실제 추천으로 보이지 않게 `예시 화면`임을 접근 가능한 보조 문구에 남긴다.
5. 기본 뉴스 썸네일은 앱 아이콘을 단순 확대하지 않고, 기존에 정한 정사각형 머니로드 기본 썸네일 자산을 사용한다.
6. 원본과 웹 최적화본을 구분한다. 웹에는 최적화본만 둔다.
7. 파일명은 kebab-case로 작성한다.
8. 이미지 교체만으로 레이아웃이 깨지지 않도록 `PhoneScreen`에서 비율과 crop 정책을 통제한다.

---

## 14. 구현 순서

### Phase 1 — 콘텐츠와 자산 확정

1. 실제 최신 화면에서 홈, 종목 상세, 가격 알림, 뉴스, 토론, 시그널 화면을 확인한다.
2. `AI 요약` 노출이 없는지 확인한다.
3. hero에 쓸 앞·뒤 화면과 섹션별 화면을 확정한다.
4. 실제 화면이 부족한 기능은 코드 기반 mock screen으로 만든다.

### Phase 2 — device system 분리

1. `phone-frame.tsx`
2. `phone-screen.tsx`
3. `phone-stack.tsx`
4. 각 component를 독립적으로 확인할 수 있는 임시 사용 예시

### Phase 3 — 콘텐츠와 screen-content 분리

1. `landing-content.ts`
2. 화면별 `screen-content`
3. floating cards
4. 실제 이미지와 코드 화면이 동일한 frame 안에서 동작하는지 확인

### Phase 4 — 섹션 구현

1. navigation
2. hero와 capability strip
3. 관심 종목
4. 목표가 알림
5. 뉴스와 머니로드 요약
6. 토론
7. 시그널
8. how-it-works
9. final CTA와 footer

### Phase 5 — metadata, responsive, QA

1. 한국어 폰트와 metadata
2. Open Graph 자산
3. mobile/tablet/desktop 반응형
4. 접근성
5. 성능과 빌드 검증

---

## 15. 구현 시 예상 변경 파일

### 변경

- `apps/web/src/app/page.tsx`
- `apps/web/src/app/layout.tsx`
- 필요 시 `apps/web/src/index.css`
- 필요 시 `apps/web/src/components/landing/brand.tsx`

### 재사용

- `apps/web/src/components/landing/store-buttons.tsx`
- `packages/ui/src/components/button.tsx`
- `packages/ui/src/globals.css`의 MoneyRoad 토큰

### 추가

- `apps/web/src/components/landing/landing-content.ts`
- `apps/web/src/components/landing/landing-navigation.tsx`
- `apps/web/src/components/landing/landing-footer.tsx`
- `apps/web/src/components/landing/device/*.tsx`
- `apps/web/src/components/landing/screen-content/*.tsx`
- `apps/web/src/components/landing/floating/*.tsx`
- `apps/web/src/components/landing/sections/*.tsx`
- `apps/web/public/landing/screens/*`
- `apps/web/public/landing/thumbnails/*`
- `apps/web/public/landing/og/*`

### 변경하지 않음

- API와 DB
- native 앱 코드
- 스토어 URL
- waitlist 관련 API·DB
- 다른 web route

---

## 16. 검증 계획

### 정적 검증

- 사용자에게 보이는 `AI 요약` 문자열이 랜딩에 0개인지 확인한다.
- `머니로드 요약`이 뉴스 소개와 목업에 일관되게 표시되는지 확인한다.
- 0~100 종합 점수, 4개 소스 종합 등 근거가 불확실한 문구가 제거됐는지 확인한다.
- App Store와 Google Play URL이 기존 값과 같은지 확인한다.
- 개인정보 처리방침과 투자 유의 안내가 유지되는지 확인한다.

### 반응형 시각 검증

- 1440×900
- 1280×800
- 1024×768
- 768×1024
- 430×932
- 390×844
- 360×800

확인 항목:

- hero의 두 휴대폰이 모든 폭에서 겹쳐 보인다.
- 모바일에 가로 스크롤이 없다.
- 뒤 휴대폰이 완전히 사라지지 않는다.
- store buttons가 잘리지 않는다.
- 각 섹션의 heading 순서와 여백이 일정하다.
- `머니로드 요약` 칩과 텍스트가 이미지에 가려지지 않는다.

### 접근성 검증

- 키보드만으로 navigation, store links, privacy link를 이동할 수 있다.
- focus 표시가 보인다.
- 이미지 alt와 `aria-hidden` 사용이 중복되지 않는다.
- reduced motion에서 불필요한 animation이 멈춘다.
- 색 대비와 200% zoom을 확인한다.

### 코드 검증

```bash
pnpm -F web build
pnpm check-types
pnpm check
```

전체 `pnpm check`에서 기존 무관 오류가 발견되면 이번 작업으로 생긴 오류와 구분해 보고한다. `biome.json`을 바꿔 회피하지 않는다.

---

## 17. 완료 조건

- [ ] 머니로드의 파란 메인 컬러가 hero와 핵심 CTA에서 분명하게 유지된다.
- [ ] hero에 Design 5를 반영한 겹친 두 대의 휴대폰이 있다.
- [ ] `PhoneFrame`, `PhoneScreen`, `PhoneStack`, 화면 내부 콘텐츠가 서로 다른 파일로 분리된다.
- [ ] 화면 내부 카드와 문구를 데이터 파일에서 쉽게 넣고 뺄 수 있다.
- [ ] 현재 `page.tsx`는 섹션 조립 중심으로 단순해진다.
- [ ] 관심 종목, 현재가·차트, 목표가 알림, 뉴스, 머니로드 요약, 시그널, 토론의 흐름이 모두 소개된다.
- [ ] 사용자 노출 `AI 요약`은 전부 `머니로드 요약`으로 바뀐다.
- [ ] 앱 내 주문·결제, 수익 보장, 실제 보유자 인증을 암시하지 않는다.
- [ ] 기존 iOS·Android 스토어 링크가 유지된다.
- [ ] 투자 유의 안내와 개인정보 처리방침이 유지된다.
- [ ] desktop, tablet, mobile에서 가로 overflow 없이 동작한다.
- [ ] 접근성, 이미지 최적화, reduced motion 기준을 충족한다.
- [ ] 새 라이브러리 없이 기존 Next.js, Tailwind, Lucide, shared UI로 구현한다.

---

## 18. 최종 디자인 결정 요약

이번 랜딩은 단순히 앱 화면을 나열하는 페이지가 아니라, 주식 투자자가 머니로드를 사용하는 순서를 그대로 따라가는 페이지로 만든다.

1. 파란 히어로에서 두 대의 휴대폰으로 `관심 종목 + 목표가 알림`을 먼저 보여준다.
2. 관심 종목을 모으는 이유를 설명한다.
3. 원하는 매수·매도 검토 가격을 미리 정하는 가격 알림을 강조한다.
4. 뉴스와 `머니로드 요약`으로 가격 변화의 배경을 읽게 한다.
5. 같은 종목을 보는 사용자들의 토론을 추가 맥락으로 보여준다.
6. 매수·매도·관망 시그널과 모든 정보를 하나의 판단 흐름으로 연결한다.
7. 마지막에 스토어 다운로드와 투자 유의 안내로 마무리한다.

시각적으로는 Design 1과 3의 구조, Design 2의 맑고 프리미엄한 블루 표현, Design 4의 일관된 브랜드 시스템, Design 5의 겹친 두 대의 휴대폰 구도를 결합한다. 결과물은 화려함보다 `정보가 많아도 판단 흐름은 선명하다`는 인상을 우선한다.
