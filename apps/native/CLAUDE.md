# Native(Expo) 폴더 구조 규칙

이 앱(`apps/native`)의 디렉터리/배치 규칙. Expo 공식 글
**["How to organize Expo app folder structure for clarity and scalability"](https://expo.dev/blog/expo-app-folder-structure-best-practices)**
(Kadi Kraman, 2025-09 / changelog 2026-01)의 내용을 이 프로젝트 컨벤션으로
구체화한 것이다. **native 코드 작성·이동·생성 시 반드시 지킨다.**

루트 규칙(`/.claude/CLAUDE.md`, Ultracite/Biome)은 그대로 적용되며, 이 문서는
그 위에 **구조(structure)** 규칙을 더한다.

---

## 1. `/src` 폴더 사용 (모든 앱 소스는 `src/` 아래)

라우트 트리는 `src/app`. 앱 코드(`src/`)와 설정 파일(`app.json`, `eas.json` 등
루트)을 분리한다. 새 소스는 `src/` 하위 디렉터리 중 하나에만 만든다.

| 디렉터리 | 용도 |
|---|---|
| `src/app` | **라우트 전용** (Expo Router): 라우트 파일, `_layout.tsx`, 라우트 그룹 |
| `src/screens` | 화면 컴포넌트 (`<name>/index.tsx`) |
| `src/components` | 재사용 UI 컴포넌트 |
| `src/hooks` | 재사용 훅 (`use-*.ts`) |
| `src/utils` | 순수 헬퍼 + 앱 데이터/설정 (format, nav, theme, data 등) |
| `src/lib` | 외부 SDK/클라이언트 설정 (auth-client, stream-token) — *프로젝트 추가* |
| `src/contexts` | React Context 프로바이더 — *프로젝트 추가* |

> 이 앱은 Expo Router **API routes(`+api.ts`)를 쓰지 않는다**(백엔드는 `apps/server`).
> 따라서 글의 `app/api`·`/server` 폴더 규칙은 이 앱에 해당 없음.

## 2. components — 재사용 컴포넌트

- 컴포넌트당 **named export 1개**, export 이름은 **PascalCase**.
- **파일명은 kebab-case**로 통일한다 (글 2026-01 changelog 기본 권장, SDK55 템플릿 일치).
  예: `MyComponent` → `my-component.tsx`.
- 여러 파일로 쪼갤 컴포넌트는 **폴더 + `index.tsx`(루트 컴포넌트)** 로 만들고,
  그 컴포넌트에서만 쓰는 하위 컴포넌트는 같은 폴더의 `components/`에 콜로케이트.
  ```
  src/components/table/
  ├── components/        # table에서만 쓰는 하위 컴포넌트
  │   ├── row.tsx
  │   └── cell.tsx
  └── index.tsx          # export function Table()
  ```
- ⚠️ 여기서 `index.tsx`는 **루트 컴포넌트**다. **re-export만 하는 barrel 파일은 금지**
  (Biome `noBarrelFile`).

## 3. screens — 화면 컴포넌트

- `src/app`의 라우트 파일은 **얇게(thin route)**: 화면을 `src/screens`에서 import해
  렌더하고, **라우트 고유 처리(url 파라미터, 인증 게이트 등)만** 라우트에서 한다.
  ```tsx
  // src/app/(moneyroad)/(tabs)/news.tsx
  import NewsScreen from "@/screens/news";
  export default function NewsRoute() {
    return <NewsScreen />;
  }
  ```
- 화면은 `src/screens/<name>/index.tsx`. 그 화면에서만 쓰는 하위 컴포넌트는
  `src/screens/<name>/components/`에 콜로케이트.
- 같은 화면을 여러 라우트에서 재사용하기 쉬운 것도 이 구조의 장점.

## 4. utils & hooks

- `src/utils`: 작은 독립 유틸 (날짜 포매터, 변환기 등). 파일명 kebab-case (`format-date.ts`).
- `src/hooks`: 재사용 훅. `use-*.ts` (`use-app-state.ts`).

## 5. 플랫폼별 코드 — 확장자로 분리

`Platform.select`/`Platform.OS` 분기가 커지면 **플랫폼별 파일 확장자**로 분리한다.
- 지원 확장자: `.web`, `.native`, `.ios`, `.android`
- **확장자 없는 기본 파일이 항상 필요**(한 플랫폼 전용이면 기본은 no-op).
- import는 확장자 없이: `import { BarChart } from "@/components/bar-chart"` →
  metro가 타깃에 맞는 파일(`bar-chart.web.tsx` 등)을 자동 선택.
- 두 구현의 **props는 동일**해야 한다.

## 6. 스타일 콜로케이션

`StyleSheet`를 별도 `*.styles.ts` 파일로 빼지 말고 **컴포넌트 파일 하단**에 둔다.
(이 앱은 주로 `useMrTheme()` 테마 토큰 + 인라인 스타일을 쓰며, 이 경우도 같은 파일 내 유지.)

## 7. 테스트 콜로케이션

테스트는 대상 파일 **바로 옆**에 둔다(별도 `__tests__` 폴더 X).
`format-date.ts` ↔ `format-date.test.ts`.

## 8. 네이밍

- **파일명: kebab-case + 소문자** (라우트, 컴포넌트, 훅, 유틸, 스크린 디렉터리 전부).
- 컴포넌트 export: PascalCase. 훅: `use-*`.
- 라우트 그룹: 괄호 `(group)` (URL 영향 없음). 네비게이터: `_layout.tsx`.

---

## 프로젝트 추가 규칙 (이 레포 고유)

- **import는 `@/` 별칭** (`@/* → src/*`). `../../..` 깊은 상대경로 금지.
- **라우트 이동은 `src/utils/nav.ts` 헬퍼**로 일원화. 화면 곳곳에
  `router.push("/..." as Href)`를 흩뿌리지 않는다. 새 경로는 `nav`에 추가.
- **인증/온보딩 게이트는 라우트 파일(또는 `_layout`)에서** 처리. 화면 컴포넌트는
  "로그인된 사용자" 전제로 단순하게 유지.
  ```tsx
  if (!session?.user) return <Redirect href="/(moneyroad)/login" />;
  return <MyPageScreen />;
  ```
- 외부 SDK/클라이언트 초기화는 `src/lib`, React Context는 `src/contexts`.

## 하지 말 것 (Don't)

- ❌ `src/app`에 화면/재사용 컴포넌트/비즈니스 로직 정의 (라우트만)
- ❌ 라우트 파일에서 직접 `useQuery`/`fetch` 등 데이터 패칭
- ❌ re-export 전용 barrel 파일 (Biome `noBarrelFile`) — 단, `폴더/index.tsx` **루트
  컴포넌트**는 허용
- ❌ 깊은 상대경로 import (`../../../components`)
- ❌ 화면 컴포넌트 안에 인증 리다이렉트 로직 (라우트/레이아웃에서 처리)
- ❌ 스타일을 별도 `*.styles` 파일로 분리
