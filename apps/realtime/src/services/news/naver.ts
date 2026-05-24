import { parseNewsBody, parseNewsTitle } from "./parser";
import type { NaverNewsItem } from "./types";

interface NaverNewsResponse {
  display: number;
  items: NaverNewsItem[];
  lastBuildDate: string;
  start: number;
  total: number;
}

const CRAWL_TIMEOUT_MS = 5000;
const CONTENT_MAX_LEN = 2000;
const MAX_TAGS = 10;

// Top-level regex literals (avoid re-compiling per item).
const RE_WWW = /^www\./;
const RE_SOURCE_LOGO =
  /<img[^>]+class="[^"]*media_end_head_top_logo[^"]*"[^>]+alt="([^"]+)"/;
const RE_SOURCE_PRESS = /class="[^"]*press_logo[^"]*"[^>]*alt="([^"]+)"/;
const RE_CONTENT_DIC = /<div[^>]+id="dic_area"[^>]*>([\s\S]*?)<\/div>/;
const RE_CONTENT_BODY = /<div[^>]+id="articeBody"[^>]*>([\s\S]*?)<\/div>/;
const RE_BRACKET_KEYWORD = /[[(【「『]([가-힣a-zA-Z0-9·\s]+)[\])】」』]/g;

const CRAWL_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** Fetches the latest news items for a query from the Naver search API. */
export async function fetchNaverNewsList(
  query: string,
  clientId: string,
  clientSecret: string,
  display = 20
): Promise<NaverNewsItem[]> {
  const params = new URLSearchParams({
    query,
    display: String(display),
    sort: "date",
  });

  const res = await globalThis.fetch(
    `https://openapi.naver.com/v1/search/news.json?${params}`,
    {
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
      },
    }
  );

  if (!res.ok) {
    throw new Error(`NaverNews API 응답 오류: ${res.status} (query: ${query})`);
  }

  const data = (await res.json()) as NaverNewsResponse;
  return data.items;
}

/** Extracts the press domain from the original link as a source fallback. */
export function extractSourceFromUrl(originallink: string): string | null {
  try {
    const url = new URL(originallink);
    return url.hostname.replace(RE_WWW, "");
  } catch {
    return null;
  }
}

/** Crawls a Naver news page for the press name and article body. */
export async function crawlNaverArticle(
  link: string
): Promise<{ source: string | null; content: string | null }> {
  if (!link.includes("news.naver.com")) {
    return { source: null, content: null };
  }
  try {
    const res = await globalThis.fetch(link, {
      headers: { "User-Agent": CRAWL_USER_AGENT },
      signal: AbortSignal.timeout(CRAWL_TIMEOUT_MS),
    });
    if (!res.ok) {
      return { source: null, content: null };
    }

    const html = await res.text();

    let source: string | null = null;
    for (const pattern of [RE_SOURCE_LOGO, RE_SOURCE_PRESS]) {
      const match = html.match(pattern);
      if (match?.[1]) {
        source = match[1];
        break;
      }
    }

    let content: string | null = null;
    for (const pattern of [RE_CONTENT_DIC, RE_CONTENT_BODY]) {
      const match = html.match(pattern);
      if (match?.[1]) {
        const cleaned = parseNewsBody(match[1]);
        if (cleaned.length > 0) {
          content = cleaned.slice(0, CONTENT_MAX_LEN);
          break;
        }
      }
    }

    return { source, content };
  } catch {
    return { source: null, content: null };
  }
}

/** Builds tags from the (cleaned) title plus the search query. */
export function extractTags(title: string, query: string): string[] {
  const tags = new Set<string>([query]);
  const matches = parseNewsTitle(title).matchAll(RE_BRACKET_KEYWORD);
  for (const match of matches) {
    const keyword = match[1]?.trim();
    if (keyword && keyword.length >= 2) {
      tags.add(keyword);
    }
  }
  return [...tags].slice(0, MAX_TAGS);
}

const GLOBAL_KEYWORDS = [
  "미국",
  "nasdaq",
  "나스닥",
  "해외",
  "글로벌",
  "달러",
  "s&p",
  "뉴욕",
  "유럽",
  "중국",
  "일본",
];
const SECTOR_KEYWORDS = [
  "반도체",
  "배터리",
  "2차전지",
  "ai",
  "인공지능",
  "바이오",
  "자동차",
  "화학",
  "철강",
  "금융",
  "은행",
  "it",
  "게임",
  "엔터",
  "방산",
];
const MARKET_KEYWORDS = [
  "주식",
  "코스피",
  "코스닥",
  "증시",
  "시장",
  "주가",
  "etf",
  "종목",
];

/** Heuristic category from the query (fallback when AI is disabled). */
export function classifyCategory(
  query: string
): "market" | "sector" | "global" | null {
  const lower = query.toLowerCase();
  if (GLOBAL_KEYWORDS.some((k) => lower.includes(k))) {
    return "global";
  }
  if (SECTOR_KEYWORDS.some((k) => lower.includes(k))) {
    return "sector";
  }
  if (MARKET_KEYWORDS.some((k) => lower.includes(k))) {
    return "market";
  }
  return null;
}
