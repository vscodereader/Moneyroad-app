import type { FastifyInstance } from "fastify";
import { signalFeedHub, streamSignalFeed } from "@/services/signal";
import { registerRefreshChannel } from "./refresh-channel";

// 시그널 피드를 다시 불러오게 하는 공개 SSE 채널. 관리자가 시그널을 추가/삭제할
// 때마다 접속한 전 클라이언트를 깨운다. `signal.feed`/`signal.counts` 가
// publicProcedure 라 토큰은 선택이다.
export function registerSignalPlugin(app: FastifyInstance) {
  registerRefreshChannel(app, {
    channel: "signal-feed",
    logKey: "signal",
    clientCount: () => signalFeedHub.clientCount,
    stream: streamSignalFeed,
  });
}
