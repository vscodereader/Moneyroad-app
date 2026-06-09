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
