import { env } from "@moneyroad-app/env/realtime";
import { createError, log } from "evlog";
import type { MarketDataFeed, Quote } from "./types";

const WS_URL = {
  prod: "ws://ops.koreainvestment.com:21000",
  paper: "ws://ops.koreainvestment.com:31000",
} as const;

const REST_URL = {
  prod: "https://openapi.koreainvestment.com:9443",
  paper: "https://openapivts.koreainvestment.com:29443",
} as const;

// 실시간 체결가 TR. 호가(H0STASP0) 등 다른 스트림은 별도 TR로 추가한다.
const TR_TRADE = "H0STCNT0";
const TR_TYPE_SUBSCRIBE = "1";
const TR_TYPE_UNSUBSCRIBE = "2";

/**
 * KIS(한국투자증권) 실시간 시세 어댑터 — Phase 1 스켈레톤.
 *
 * 흐름: approval_key 발급(REST) → WebSocket 접속 → tr_id별 등록/해제 →
 * 파이프 구분 프레임 파싱. tr_id별 필드 인덱스와 PINGPONG/암호화 처리는
 * KIS 문서로 검증한 뒤 채워야 한다(아래 TODO).
 */
export class KisFeed implements MarketDataFeed {
  private socket: WebSocket | null = null;
  private approvalKey = "";
  private handler: ((quote: Quote) => void) | null = null;
  private readonly registered = new Set<string>();

  async start(): Promise<void> {
    if (!(env.KIS_APP_KEY && env.KIS_APP_SECRET)) {
      throw createError({
        message: "KIS feed cannot start",
        status: 500,
        why: "KIS_APP_KEY/KIS_APP_SECRET are not set",
        fix: "Set KIS_APP_KEY and KIS_APP_SECRET, or run with FEED=mock",
      });
    }
    this.approvalKey = await this.fetchApprovalKey();
    this.connect();
  }

  stop(): void {
    this.socket?.close();
    this.socket = null;
  }

  subscribe(symbol: string): void {
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
      log.warn({ kis: { event: "disconnected" } });
      // TODO: 지수 백오프 재연결, approval_key 만료 갱신
    });
    this.socket = socket;
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
        body: { input: { tr_id: TR_TRADE, tr_key: symbol } },
      })
    );
  }

  private handleMessage(raw: string): void {
    if (!raw) {
      return;
    }
    // 제어 메시지(JSON): 등록 응답, PINGPONG 등
    if (raw.startsWith("{")) {
      // TODO: PINGPONG 수신 시 동일 페이로드로 echo 응답
      return;
    }
    const quote = this.parseTradeFrame(raw);
    if (quote) {
      this.handler?.(quote);
    }
  }

  private parseTradeFrame(raw: string): Quote | null {
    // 형식: `0|H0STCNT0|001|005930^체결시각^현재가^...`
    const parts = raw.split("|");
    const trId = parts[1];
    const payload = parts[3];
    if (trId !== TR_TRADE || !payload) {
      return null;
    }
    const fields = payload.split("^");
    const symbol = fields[0];
    const priceText = fields[2]; // TODO: 현재가 인덱스를 KIS 문서로 확인
    if (!(symbol && priceText)) {
      return null;
    }
    const price = Number(priceText);
    if (Number.isNaN(price)) {
      return null;
    }
    return { symbol, price, ts: Date.now() };
  }
}
