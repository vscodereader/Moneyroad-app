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

const DISCUSSION_TRIGGER_PATH = "/internal/refresh-discussion-list";

/**
 * Fire-and-forget nudge to the realtime service so it broadcasts a
 * "discussion" event to every connected client (→ they refetch the room list
 * at once) right after a discussion list mutation — instead of waiting for a
 * manual refresh (RFC 0004 feature 1).
 *
 * ⚠️ This is NOT `refreshRealtimeNews`/`refreshRealtimePins`: it hits a
 * separate `/internal/refresh-discussion-list` endpoint (discussion room list
 * only). Best-effort — never blocks, swallows every failure after logging.
 */
export function refreshRealtimeDiscussion(reason: string): void {
  const url = `${env.REALTIME_INTERNAL_URL}${DISCUSSION_TRIGGER_PATH}`;
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
            event: "refresh_discussion_rejected",
            status: res.status,
            reason,
          },
        });
      }
    })
    .catch((error) => {
      log.warn({
        realtimeTrigger: { event: "refresh_discussion_failed", reason },
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

// ----(시그널 푸시 알림 — RFC 0007)----
const SIGNAL_NOTIFY_PATH = "/internal/notify-signal";

export interface SignalNotifyInput {
  action: "buy" | "sell" | "hold";
  signalId: string;
  stockCode: string;
  title: string;
}

/**
 * Fire-and-forget nudge so realtime pushes this new signal to users who watch
 * the stock and have the matching alert enabled (docs/rfcs/0007).
 *
 * ⚠️ This is NOT `refreshRealtimeSignal`. That one broadcasts "refetch the
 * list" to every connected client and also fires on delete; this one targets
 * specific users and only fires on create. Both run on `signal.create`.
 *
 * 푸시 발송을 기다리지 않는다 — 알림이 실패해도 시그널 생성은 성공해야 한다.
 */
export function notifyRealtimeSignal(input: SignalNotifyInput): void {
  const url = `${env.REALTIME_INTERNAL_URL}${SIGNAL_NOTIFY_PATH}`;
  fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-secret": env.STREAM_TOKEN_SECRET,
    },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
    .then((res) => {
      if (!res.ok) {
        log.warn({
          realtimeTrigger: {
            event: "notify_signal_rejected",
            status: res.status,
            signalId: input.signalId,
          },
        });
      }
    })
    .catch((error) => {
      log.warn({
        realtimeTrigger: {
          event: "notify_signal_failed",
          signalId: input.signalId,
        },
        error,
      });
    });
}
// ----(끝)----
