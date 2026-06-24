# Web Store Download CTA Design

## Context

머니로드 iOS/Android 앱이 App Store와 Google Play에 공개되었으므로 웹 랜딩의 목적을 사전등록 수집에서 앱 설치 전환으로 바꾼다.

## Decision

사전등록 이메일 폼을 랜딩의 주요 화면에서 제거하고, App Store와 Google Play로 이동하는 공식 아이콘 기반 ghost 스타일 스토어 버튼을 헤더, 히어로, 하단 CTA 흐름에 맞게 배치한다.

## Store Links

- App Store: `https://apps.apple.com/kr/app/%EB%A8%B8%EB%8B%88%EB%A1%9C%EB%93%9C/id6772923139`
- Google Play: `https://play.google.com/store/apps/details?id=kr.ai.moneyroad`

## Button Style

- 공식 스토어 배지는 검정 배경이 artwork 자체에 포함되어 있으므로 ghost 스타일 요구와 맞지 않는다.
- 랜딩에서는 공식 스토어 아이콘을 투명 배경의 ghost 버튼 안에 넣고, hover/focus 상태에서만 가벼운 강조색을 보여준다.

## UX

- 헤더 CTA는 `#download` 앵커로 이동해 사용자가 두 스토어 중 선택하게 한다.
- 히어로에는 "정식 출시" 상태를 명확히 보여주고, 다운로드 버튼 두 개를 첫 화면에 노출한다.
- 하단 CTA 밴드는 설치 행동을 다시 유도한다.
- 기존 투자 유의 안내와 기능 설명은 유지한다.

## Scope

- 변경: `apps/web/src/app/page.tsx`
- 변경: `apps/web/src/app/layout.tsx`
- 추가: `apps/web/src/components/landing/store-buttons.tsx`
- 빌드 호환성 수정: `packages/ui/src/components/skeleton.tsx`
- 유지: waitlist API, DB schema, 기존 `WaitlistForm` 파일

## Testing

- 정적 검증으로 랜딩에 스토어 URL과 출시 카피가 포함되고 사전등록 CTA가 제거되었는지 확인한다.
- `apps/web` 타입체크 중 드러난 `Skeleton`의 전역 React 타입 참조를 같은 UI 패키지 패턴에 맞춰 type import로 고정한다.
- `pnpm -F web build`로 Next.js 빌드가 통과하는지 확인한다.
- `pnpm check` 또는 `pnpm dlx ultracite check`로 Ultracite 기준을 확인한다.
