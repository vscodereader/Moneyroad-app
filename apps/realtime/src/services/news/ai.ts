import { google } from "@ai-sdk/google";
import { env } from "@moneyroad-app/env/realtime";
import { generateObject } from "ai";
import { log } from "evlog";
import { z } from "zod";

import type { NewsCategory } from "./types";

const NEWS_CATEGORIES = [
  "market",
  "sector",
  "global",
  "company",
  "other",
] as const;

/** True when AI enrichment is configured (Google Generative AI key present). */
export function isAiConfigured(): boolean {
  return Boolean(env.GOOGLE_GENERATIVE_AI_API_KEY);
}

/* ----(뉴스 AI 배치 분류: 시작)---- */
// 요약은 하지 않고 "라벨(카테고리)"만 붙인다. 한 번의 요청에 여러 기사를 넣어
// (제목+본문 → 인덱스별 라벨) 무료 티어 분당 한도를 넉넉히 피한다.
// 모델은 NEWS_AI_MODEL(기본 gemini-flash-latest): 배치라 호출이 적어 20 RPM 여유 + 게이팅 품질 우선.
// "none" = 증시 무관(기타) → 호출부에서 제외(수집 안 함)한다. 출력 검증은 Zod.
const CLASSIFY_LABELS = [...NEWS_CATEGORIES, "none"] as const;

const classifyBatchSchema = z.object({
  labels: z.array(
    z.object({
      i: z.number().int(),
      label: z.enum(CLASSIFY_LABELS),
    })
  ),
});

const CLASSIFY_BODY_MAX = 500;
const CLASSIFY_RULES = `각 기사를 아래 중 하나로 분류하라. i(인덱스)는 그대로 반환.
증시(주식/증권/상장기업)와 직접 관련될 때만 카테고리를 붙이고, 아니면 반드시 none.
- market: 코스피/코스닥 등 증시 전반, 지수, 수급
- sector: 특정 업종/섹터/테마 (반도체, 2차전지, 바이오, 방산 등)
- company: 개별 상장기업 이슈 (실적, 공시, 수주, 유상증자, M&A)
- global: 미국/글로벌 증시, 나스닥, 환율, 서학개미
- other: 증시에 영향을 주는 정부/규제/세제/금융당국/법안 정책만 (증시 무관 정치 공방은 제외)
- none: 증시와 무관한 모든 것 — 정치 공방·정치인 개인 논란·여론조사·선거, 판결/재판,
  스포츠, 연예, 부동산 개인거래, 광고, 앱테크/퀴즈/운세 등`;

/**
 * Batch-classifies articles into a news category. Returns one entry per input
 * (in order): a NewsCategory to keep, or null when the model marks it "none"
 * (기타 → caller drops it). Returns null for the WHOLE batch when AI is
 * unconfigured or the call fails, so the caller can fall back to the rule-based
 * classifier. Does no summarization.
 */
export async function classifyNewsBatch(
  articles: { title: string; body: string }[]
): Promise<(NewsCategory | null)[] | null> {
  if (!isAiConfigured() || articles.length === 0) {
    return null;
  }
  const list = articles
    .map(
      (a, i) =>
        `[${i}] 제목: ${a.title}\n본문: ${a.body.slice(0, CLASSIFY_BODY_MAX)}`
    )
    .join("\n\n");
  try {
    const { object } = await generateObject({
      model: google(env.NEWS_AI_MODEL),
      schema: classifyBatchSchema,
      prompt: `${CLASSIFY_RULES}\n\n기사 목록:\n${list}`,
      // 429(쿼터) 시 재시도가 오히려 분당 한도를 더 깎는 악순환을 막는다.
      // 실패하면 즉시 null 반환 → 규칙 폴백 → 다음 사이클에 새로 시도.
      maxRetries: 1,
    });
    const byIndex = new Map(object.labels.map((l) => [l.i, l.label]));
    return articles.map((_, i) => {
      const label = byIndex.get(i);
      if (!label || label === "none") {
        return null;
      }
      return label;
    });
  } catch (err) {
    log.error({ err, news: { event: "ai_classify_failed" } });
    return null;
  }
}
/* ----(뉴스 AI 배치 분류: 끝)---- */
