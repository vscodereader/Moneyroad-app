import type { FastifyInstance } from "fastify";
import { discussionHub, streamDiscussionList } from "@/services/discussion";
import { registerRefreshChannel } from "./refresh-channel";

// 토론 목록을 다시 불러오게 하는 공개 SSE 채널 (RFC 0004 기능1). 쓰기가 일어날
// 때마다 접속한 전 클라이언트를 깨운다. 연결·인증·로그는 registerRefreshChannel
// 이 담당한다 — signal-feed 채널과 한 글자도 다르지 않던 부분이다.
export function registerDiscussionPlugin(app: FastifyInstance) {
  registerRefreshChannel(app, {
    channel: "discussion-list",
    logKey: "discussion",
    clientCount: () => discussionHub.clientCount,
    stream: streamDiscussionList,
  });
}
