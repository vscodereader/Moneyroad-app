import { useEffect, useRef } from "react";
import { AppState } from "react-native";

/**
 * 앱이 background에서 active로 복귀할 때 `onResume`을 호출한다.
 *
 * iOS는 앱을 suspend하는 동안 TCP 소켓을 조용히 끊는데, 이때 react-native-sse가
 * `error` 이벤트를 안정적으로 발생시키지 못해 SSE 연결이 좀비 상태로 남는다.
 * 복귀 시점에 강제로 재연결을 트리거하기 위한 공용 훅이다.
 *
 * 실제 `background`를 거친 복귀에서만 발화한다 — 제어센터/앱스위처 미리보기처럼
 * `inactive`만 잠깐 거치는 전환에서는 소켓이 유지되므로 불필요한 재연결을 피한다.
 */
export function useAppStateResume(onResume: () => void): void {
  // 매 렌더마다 최신 콜백을 ref에 담아, 리스너는 한 번만 등록하면서도
  // 항상 최신 클로저를 호출하게 한다.
  const onResumeRef = useRef(onResume);
  onResumeRef.current = onResume;

  useEffect(() => {
    let wasBackgrounded = false;
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "background") {
        wasBackgrounded = true;
      } else if (next === "active" && wasBackgrounded) {
        wasBackgrounded = false;
        onResumeRef.current();
      }
    });
    return () => sub.remove();
  }, []);
}
