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

const NEWS_TRIGGER_PATH = "/internal/refresh-news";

/**
 * Fire-and-forget nudge to the realtime service so it broadcasts a "news" event
 * to every connected client (→ they refetch the feed at once) right after an
 * admin news create/update/remove — instead of waiting for the next collector
 * broadcast or a manual refresh (RFC 0002 §4-6 option B).
 *
 * ⚠️ This is NOT `refreshRealtimePins`: it hits a separate
 * `/internal/refresh-news` endpoint (news feed only), never the pin/price-alert
 * domain. Best-effort — never blocks, swallows every failure after logging.
 */
export function refreshRealtimeNews(reason: string): void {
  const url = `${env.REALTIME_INTERNAL_URL}${NEWS_TRIGGER_PATH}`;
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
            event: "refresh_news_rejected",
            status: res.status,
            reason,
          },
        });
      }
    })
    .catch((error) => {
      log.warn({
        realtimeTrigger: { event: "refresh_news_failed", reason },
        error,
      });
    });
}
