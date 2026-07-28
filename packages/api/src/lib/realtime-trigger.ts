import { env } from "@moneyroad-app/env/server";
import { log } from "evlog";

const TRIGGER_PATH = "/internal/refresh-pins";
const TIMEOUT_MS = 2000;

/**
 * Fire-and-forget nudge to the realtime service so it re-pins the
 * (watchlist ∪ signal) symbol set — and refreshes the anonymous public signal
 * whitelist — immediately instead of waiting for its ~10s poll. Call this right
 * after a watchlist/signal write so newly-added stocks start streaming at once.
 *
 * Best-effort by design: it does not block the caller (no await) and swallows
 * every failure after logging. The realtime poller stays the correctness
 * backstop, so an unreachable/misconfigured realtime URL only loses the speedup.
 * `reason` (e.g. "signal.create") is carried into logs for triage.
 */
export function refreshRealtimePins(reason: string): void {
  const url = `${env.REALTIME_INTERNAL_URL}${TRIGGER_PATH}`;
  fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-secret": env.STREAM_TOKEN_SECRET,
    },
    body: JSON.stringify({ reason }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
    .then((res) => {
      if (!res.ok) {
        log.warn({
          realtimeTrigger: {
            event: "refresh_pins_rejected",
            status: res.status,
            reason,
          },
        });
      }
    })
    .catch((error) => {
      log.warn({
        realtimeTrigger: { event: "refresh_pins_failed", reason },
        error,
      });
    });
}

// ----(시그널 목록 실시간 갱신)----
const SIGNAL_TRIGGER_PATH = "/internal/refresh-signal";

/**
 * Fire-and-forget nudge to the realtime service so it broadcasts a
 * "signal-feed" event to every connected client (→ they refetch the signal feed
 * and the filter-chip counts at once) right after an admin adds or removes a
 * signal — instead of the user having to relaunch the app or pull to refresh.
 *
 * ⚠️ This is NOT `refreshRealtimePins`. That one only refreshes the *symbol set*
 * realtime streams quotes for (watchlist ∪ signal) plus the anonymous whitelist;
 * it never touches the feed, which is exactly why the signal list looked frozen.
 * Both are called on a signal write — they do different jobs.
 *
 * Best-effort — never blocks, swallows every failure after logging.
 */
export function refreshRealtimeSignal(reason: string): void {
  const url = `${env.REALTIME_INTERNAL_URL}${SIGNAL_TRIGGER_PATH}`;
  fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-secret": env.STREAM_TOKEN_SECRET,
    },
    body: JSON.stringify({ reason }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
    .then((res) => {
      if (!res.ok) {
        log.warn({
          realtimeTrigger: {
            event: "refresh_signal_rejected",
            status: res.status,
            reason,
          },
        });
      }
    })
    .catch((error) => {
      log.warn({
        realtimeTrigger: { event: "refresh_signal_failed", reason },
        error,
      });
    });
}
// ----(끝)----
