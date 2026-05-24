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

const summarySchema = z.object({
  summary: z.string().describe("기사를 한국어 2~3문장으로 요약"),
  category: z
    .enum(NEWS_CATEGORIES)
    .describe(
      "market(시장/증시 전반), sector(업종/테마), global(해외/글로벌), company(개별 기업), other(기타) 중 하나"
    ),
});

export interface NewsSummary {
  category: NewsCategory;
  summary: string;
}

/** True when AI enrichment is configured (Google Generative AI key present). */
export function isAiConfigured(): boolean {
  return Boolean(env.GOOGLE_GENERATIVE_AI_API_KEY);
}

const PROMPT_BODY_MAX = 1500;

/**
 * Summarizes and classifies a single news article. Returns null when AI is not
 * configured or the call fails, so the caller can fall back to heuristics.
 */
export async function summarizeNews(article: {
  title: string;
  body: string;
}): Promise<NewsSummary | null> {
  if (!isAiConfigured()) {
    return null;
  }

  const body = article.body.slice(0, PROMPT_BODY_MAX);
  try {
    const { object } = await generateObject({
      model: google(env.NEWS_AI_MODEL),
      schema: summarySchema,
      prompt: `다음 주식/경제 뉴스를 요약하고 분류하세요.\n\n제목: ${article.title}\n\n본문:\n${body}`,
    });
    return object;
  } catch (err) {
    log.error({ err, news: { event: "ai_summarize_failed" } });
    return null;
  }
}
