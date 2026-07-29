import { type RefreshEvent, RefreshHub, streamRefresh } from "./refresh-hub";

// Singleton wiring: one hub per process. The API server triggers a refresh via
// POST /internal/refresh-signal, which fans out to every SSE client.
//
// ⚠️ 지금은 관리자 signal.create/remove 만 이 hub 를 깨운다. docs/realtime/plan.md
// "시그널 엔진"과 docs/native/api/signals.md 계획대로 **크론 엔진이 realtime 안에서**
// signal 행을 직접 적재하게 되면, 그 적재 직후에도 broadcastRefresh() 를 불러야
// 유저 화면이 갱신된다. 엔진은 같은 프로세스라 HTTP(/internal/refresh-signal)를
// 거치지 말고 이 export 를 직접 부르면 된다 — 뉴스 수집기가 newsHub 를 쓰는 것과 같다.
export const signalFeedHub = new RefreshHub("s");

/**
 * Bridges the push-based hub to an async generator for `reply.sse.send(...)`.
 * Runs until the client disconnects (signal aborted), keeping the SSE handler
 * pending and the connection open. Mirrors `streamDiscussionList`.
 */
export function streamSignalFeed(
  signal: AbortSignal
): AsyncGenerator<{ event: string; data: RefreshEvent }> {
  return streamRefresh(signalFeedHub, "signal-feed", signal);
}
