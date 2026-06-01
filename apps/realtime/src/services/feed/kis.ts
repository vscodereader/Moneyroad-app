import { env } from "@moneyroad-app/env/realtime";
import { createError, log } from "evlog";
import type { MarketDataFeed, Quote } from "./types";

// One persistent connection multiplexes all symbols (KIS allows a single
// realtime connection per credential). Path is /tryitout per KIS examples.
const WS_URL = {
  prod: "ws://ops.koreainvestment.com:21000/tryitout",
  paper: "ws://ops.koreainvestment.com:31000/tryitout",
} as const;

const REST_URL = {
  prod: "https://openapi.koreainvestment.com:9443",
  paper: "https://openapivts.koreainvestment.com:29443",
} as const;

// 실시간 체결가(KRX) TR. 호가(H0STASP0) 등은 별도 TR로 추가.
const TR_TRADE = "H0STCNT0";
// 국내지수 실시간 체결 TR. tr_key는 업종 구분 코드(KOSPI 0001, KOSDAQ 1001).
const TR_INDEX = "H0UPCNT0";
const TR_TYPE_SUBSCRIBE = "1";
// KIS 공식 코드는 "2"(해제). "0"을 보내면 "invalid tr_type"으로 거부되어
// KIS WS에 stale 가입이 남고 재구독 시 ALREADY IN SUBSCRIBE가 떨어진다.
const TR_TYPE_UNSUBSCRIBE = "2";

// 지수 코드는 종목 체결가가 아니라 업종 지수 TR로 구독해야 한다.
const INDEX_SYMBOLS = new Set(["0001", "1001"]);

function trIdFor(symbol: string): string {
  return INDEX_SYMBOLS.has(symbol) ? TR_INDEX : TR_TRADE;
}

// KIS limits ~41 registrations per connection.
const MAX_SYMBOLS = 40;

// Field indices within one 46-field 체결가 record (KIS ccnl_krx columns).
const FIELD_COUNT = 46;
const F_SYMBOL = 0;
const F_PRICE = 2;
const F_SIGN = 3; // 1:상한 2:상승 3:보합 4:하한 5:하락
const F_DIFF = 4; // 전일 대비 (magnitude)
const F_RATE = 5; // 전일 대비율 (%)
const F_ACML_VOL = 13; // 누적 거래량

// 국내지수 실시간 체결(H0UPCNT0) 레코드 필드 인덱스.
const F_IDX_SYMBOL = 0; // bstp_cls_code 업종 구분 코드
const F_IDX_PRICE = 2; // prpr_nmix 현재가 지수
const F_IDX_SIGN = 3; // prdy_vrss_sign 전일 대비 부호
const F_IDX_DIFF = 4; // bstp_nmix_prdy_vrss 전일 대비 (magnitude)
const F_IDX_RATE = 9; // prdy_ctrt 전일 대비율 (%)

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30_000;

function signed(magnitude: number, signCode: string | undefined): number {
  // Down when 하한(4)/하락(5); KIS sends the magnitude unsigned.
  const negative = signCode === "4" || signCode === "5";
  return negative ? -Math.abs(magnitude) : Math.abs(magnitude);
}

/**
 * KIS(한국투자증권) 실시간 체결가 어댑터.
 *
 * approval_key 발급(REST) → WebSocket(/tryitout) 1연결 → tr_id별 등록/해제 →
 * 파이프 구분 프레임 파싱. 체결가(H0STCNT0)는 평문이라 복호화 불필요.
 * 연결이 끊기면 지수 백오프로 재연결하고 등록 종목을 다시 구독한다.
 */
export class KisFeed implements MarketDataFeed {
  private socket: WebSocket | null = null;
  private approvalKey = "";
  private handler: ((quote: Quote) => void) | null = null;
  private readonly registered = new Set<string>();
  private stopped = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  async start(): Promise<void> {
    if (!(env.KIS_APP_KEY && env.KIS_APP_SECRET)) {
      throw createError({
        message: "KIS feed cannot start",
        status: 500,
        why: "KIS_APP_KEY/KIS_APP_SECRET are not set",
        fix: "Set KIS_APP_KEY and KIS_APP_SECRET, or run with FEED=mock",
      });
    }
    this.stopped = false;
    this.approvalKey = await this.fetchApprovalKey();
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
  }

  subscribe(symbol: string): void {
    if (!this.registered.has(symbol) && this.registered.size >= MAX_SYMBOLS) {
      log.warn({
        kis: {
          event: "limit",
          why: "max symbols reached",
          symbol,
          MAX_SYMBOLS,
        },
      });
      return;
    }
    this.registered.add(symbol);
    this.send(symbol, TR_TYPE_SUBSCRIBE);
  }

  unsubscribe(symbol: string): void {
    this.registered.delete(symbol);
    this.send(symbol, TR_TYPE_UNSUBSCRIBE);
  }

  onQuote(handler: (quote: Quote) => void): void {
    this.handler = handler;
  }

  private async fetchApprovalKey(): Promise<string> {
    const res = await fetch(`${REST_URL[env.KIS_ENV]}/oauth2/Approval`, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        appkey: env.KIS_APP_KEY,
        secretkey: env.KIS_APP_SECRET,
      }),
    });
    if (!res.ok) {
      throw createError({
        message: "KIS approval key request failed",
        status: 502,
        why: `KIS /oauth2/Approval responded ${res.status}`,
        fix: "Verify KIS credentials and KIS_ENV",
        internal: { status: res.status, kisEnv: env.KIS_ENV },
      });
    }
    const json = (await res.json()) as { approval_key?: string };
    if (!json.approval_key) {
      throw createError({
        message: "KIS approval key missing",
        status: 502,
        why: "KIS approval response did not include approval_key",
        fix: "Check KIS API status and credentials",
      });
    }
    return json.approval_key;
  }

  private connect(): void {
    const socket = new WebSocket(WS_URL[env.KIS_ENV]);

    socket.addEventListener("open", () => {
      this.reconnectAttempts = 0;
      log.info({
        kis: {
          event: "connected",
          env: env.KIS_ENV,
          symbols: this.registered.size,
        },
      });
      for (const symbol of this.registered) {
        this.send(symbol, TR_TYPE_SUBSCRIBE);
      }
    });

    socket.addEventListener("message", (event) => {
      this.handleMessage(typeof event.data === "string" ? event.data : "");
    });

    socket.addEventListener("error", () => {
      log.error({
        kis: { event: "error", why: "upstream KIS connection errored" },
      });
    });

    socket.addEventListener("close", () => {
      this.socket = null;
      if (!this.stopped) {
        this.scheduleReconnect();
      }
    });

    this.socket = socket;
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts += 1;
    const delay = Math.min(
      RECONNECT_BASE_MS * 2 ** (this.reconnectAttempts - 1),
      RECONNECT_MAX_MS
    );
    log.warn({
      kis: {
        event: "reconnect",
        attempt: this.reconnectAttempts,
        delayMs: delay,
      },
    });
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private send(symbol: string, trType: string): void {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      return;
    }
    this.socket.send(
      JSON.stringify({
        header: {
          approval_key: this.approvalKey,
          custtype: "P",
          tr_type: trType,
          "content-type": "utf-8",
        },
        body: { input: { tr_id: trIdFor(symbol), tr_key: symbol } },
      })
    );
  }

  private handleMessage(raw: string): void {
    if (!raw) {
      return;
    }
    // 제어 메시지(JSON): PINGPONG / 구독 응답. Node 글로벌 WebSocket은 pong()을
    // 노출하지 않으므로 KIS의 PINGPONG 텍스트 프레임을 그대로 echo 한다.
    if (raw.startsWith("{")) {
      if (raw.includes("PINGPONG")) {
        this.socket?.send(raw);
        return;
      }
      // 구독 등록 응답(SUBSCRIBE SUCCESS / 오류) 로깅 — 핸드셰이크 가시성.
      try {
        const msg = JSON.parse(raw) as {
          body?: { rt_cd?: string; msg1?: string };
        };
        if (msg.body) {
          log.info({
            kis: { event: "control", rtCd: msg.body.rt_cd, msg: msg.body.msg1 },
          });
        }
      } catch {
        // 비정형 제어 메시지는 무시
      }
      return;
    }
    // 체결가(H0STCNT0)와 지수(H0UPCNT0)는 필드 레이아웃이 다르므로 tr_id로 분기.
    const quotes =
      raw.split("|")[1] === TR_INDEX
        ? parseIndexFrames(raw)
        : parseTradeFrames(raw);
    for (const quote of quotes) {
      this.handler?.(quote);
    }
  }
}

/**
 * Parses a KIS 체결가 frame into quotes. Pure (no I/O) so it can be unit-tested
 * against synthetic frames without a live connection.
 * 형식: `<암호화>|H0STCNT0|<건수>|rec1^rec2^...` (각 레코드 46필드)
 */
export function parseTradeFrames(raw: string): Quote[] {
  const parts = raw.split("|");
  const encrypted = parts[0];
  const trId = parts[1];
  const count = Number(parts[2]);
  const payload = parts[3];
  // 체결가는 평문(0). 암호화 프레임(1)은 구독하지 않으므로 무시.
  if (encrypted !== "0" || trId !== TR_TRADE || !payload || count < 1) {
    return [];
  }

  const fields = payload.split("^");
  const ts = Date.now();
  const quotes: Quote[] = [];
  for (let i = 0; i < count; i += 1) {
    const base = i * FIELD_COUNT;
    const symbol = fields[base + F_SYMBOL];
    const price = Number(fields[base + F_PRICE]);
    if (!symbol || Number.isNaN(price)) {
      continue;
    }
    quotes.push({
      symbol,
      price,
      change: signed(Number(fields[base + F_DIFF]), fields[base + F_SIGN]),
      changeRate: signed(Number(fields[base + F_RATE]), fields[base + F_SIGN]),
      volume: Number(fields[base + F_ACML_VOL]) || undefined,
      ts,
    });
  }
  return quotes;
}

/**
 * Parses a KIS 국내지수 실시간 체결(H0UPCNT0) frame into quotes. Same pipe-frame
 * envelope as 체결가, but index records carry the 업종 지수 field set. The stride
 * is derived from the payload so the parser does not depend on the exact field
 * count. 현재가 지수(prpr_nmix)는 소수(2742.18 등)라 그대로 Number로 파싱한다.
 */
export function parseIndexFrames(raw: string): Quote[] {
  const parts = raw.split("|");
  const encrypted = parts[0];
  const trId = parts[1];
  const count = Number(parts[2]);
  const payload = parts[3];
  if (encrypted !== "0" || trId !== TR_INDEX || !payload || count < 1) {
    return [];
  }

  const fields = payload.split("^");
  const stride = Math.floor(fields.length / count);
  const ts = Date.now();
  const quotes: Quote[] = [];
  for (let i = 0; i < count; i += 1) {
    const base = i * stride;
    const symbol = fields[base + F_IDX_SYMBOL];
    const price = Number(fields[base + F_IDX_PRICE]);
    if (!symbol || Number.isNaN(price)) {
      continue;
    }
    const sign = fields[base + F_IDX_SIGN];
    quotes.push({
      symbol,
      price,
      change: signed(Number(fields[base + F_IDX_DIFF]), sign),
      changeRate: signed(Number(fields[base + F_IDX_RATE]), sign),
      ts,
    });
  }
  return quotes;
}
