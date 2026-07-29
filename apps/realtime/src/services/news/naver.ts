import { parseNewsBody, parseNewsTitle } from "./parser";
import type { NaverNewsItem, NewsCategory } from "./types";

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
// 기사 대표 이미지(og:image) — 뉴스 썸네일 소스. property→content 순서(네이버 표준).
const RE_OG_IMAGE =
  /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i;

const CRAWL_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Fetches the latest news items for a query from the Naver news search API.
 *
 * Uses the NAVER API HUB (NAVER Cloud Platform) endpoint. NAVER migrated the
 * search API off developers.naver.com, so newly issued credentials are NCP
 * API-Gateway keys sent via `X-NCP-APIGW-API-KEY-ID` / `X-NCP-APIGW-API-KEY`
 * (Client ID / Client Secret). The response payload is unchanged from the
 * legacy openapi.naver.com shape.
 */
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
    format: "json",
  });

  const res = await globalThis.fetch(
    `https://naverapihub.apigw.ntruss.com/search/v1/news?${params}`,
    {
      headers: {
        "X-NCP-APIGW-API-KEY-ID": clientId,
        "X-NCP-APIGW-API-KEY": clientSecret,
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

/** Crawls a Naver news page for the press name, article body, and og:image. */
export async function crawlNaverArticle(link: string): Promise<{
  source: string | null;
  content: string | null;
  ogImage: string | null;
}> {
  if (!link.includes("news.naver.com")) {
    return { source: null, content: null, ogImage: null };
  }
  try {
    const res = await globalThis.fetch(link, {
      headers: { "User-Agent": CRAWL_USER_AGENT },
      signal: AbortSignal.timeout(CRAWL_TIMEOUT_MS),
    });
    if (!res.ok) {
      return { source: null, content: null, ogImage: null };
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

    // ----(뉴스 썸네일: 대표 이미지 og:image 추출)----
    const ogImage = html.match(RE_OG_IMAGE)?.[1] ?? null;

    return { source, content, ogImage };
  } catch {
    return { source: null, content: null, ogImage: null };
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

// ── News content classification (rule-based, no AI) ───────────────
// Classifies an article by its own text (title + body), replacing the old
// query-string heuristic that labelled every "주식"-searched item as market.
// See docs/rfcs/0001-news-category-classification.md.

// "주식" is a substring of "주식회사" (Co., Ltd.) — the top source of false
// positives (unrelated articles that merely name a "○○ 주식회사"). Stripped
// before any keyword match.
const RE_STRIP_CORP = /주식회사|㈜|\(주\)|\(株\)/g;

// Latin/symbol tokens matched on word boundaries so they don't hit inside other
// words. Text is lowercased before matching.
const RE_ETF = /(^|[^a-z])etf([^a-z]|$)/;
const RE_ADR = /(^|[^a-z])adr([^a-z]|$)/;
const RE_FOMC = /(^|[^a-z])fomc([^a-z]|$)/;
const RE_FED = /(^|[^a-z])fed([^a-z]|$)/;
const RE_SNP = /s&p/;

interface KeywordSet {
  strong: string[];
  weak: string[];
}

// STRONG=2, WEAK=1. market deliberately excludes 주식/ETF/종목/투자 (relevance
// signals only) so a mere mention of "stocks" no longer floods the market tab,
// keeping the market tab distinct from the "all" tab.
const CATEGORY_KEYWORDS: Record<NewsCategory, KeywordSet> = {
  market: {
    strong: [
      "코스피",
      "코스닥",
      "증시",
      "주식시장",
      "유가증권시장",
      "코스닥시장",
      "시황",
      "거래대금",
      "공매도",
      "반대매매",
      "시가총액",
      "시총",
      "코스피200",
      "지수선물",
      "프로그램매매",
    ],
    weak: [
      "외국인",
      "기관",
      "순매수",
      "순매도",
      "수급",
      "주가",
      "지수",
      "급등",
      "급락",
      "반등",
      "상승세",
      "하락세",
    ],
  },
  sector: {
    strong: [
      "반도체",
      "이차전지",
      "2차전지",
      "배터리",
      "바이오",
      "제약",
      "방산",
      "방위산업",
      "조선업",
      "원전",
      "원자력",
      "로봇",
      "자율주행",
      "전기차",
      "우주항공",
      "태양광",
      "디스플레이",
      "자동차주",
      "금융주",
      "은행주",
      "증권주",
      "게임주",
      "엔터주",
      "건설주",
      "화학주",
      "철강주",
      "조선주",
      "바이오주",
      "제약주",
      "방산주",
    ],
    weak: [
      "자동차",
      "화학",
      "철강",
      "건설",
      "유통",
      "게임",
      "엔터",
      "은행",
      "증권",
      "금융",
      "인공지능",
      "플랫폼",
      "인터넷",
      "업종",
      "섹터",
      "테마",
    ],
  },
  global: {
    strong: [
      "뉴욕증시",
      "나스닥",
      "다우",
      "미국증시",
      "미국주식",
      "월가",
      "연준",
      "서학개미",
      "해외증시",
      "해외주식",
      "니케이",
      "항셍",
      "상하이종합",
      "유럽증시",
    ],
    weak: [
      "미국",
      "중국",
      "일본",
      "유럽",
      "달러",
      "환율",
      "관세",
      "글로벌",
      "해외",
    ],
  },
  other: {
    strong: [
      "금융위",
      "금융위원회",
      "금감원",
      "금융감독원",
      "금융당국",
      "금융위원장",
      "예탁결제원",
      "공정위",
      "자본시장법",
      "상법 개정",
      "증여세",
      "상속세",
      "금투세",
      "양도소득세",
      "과세",
      "규제",
      "시정명령",
      "과태료",
      "제재",
      "세제",
    ],
    weak: [
      "정부",
      "대통령",
      "국회",
      "의원",
      "법안",
      "개정안",
      "정책",
      "여야",
      "당국",
      "대책",
    ],
  },
  company: {
    strong: [
      "유상증자",
      "유상감자",
      "무상증자",
      "자사주",
      "자기주식",
      "주주총회",
      "최대주주",
      "공개매수",
      "제3자배정",
      "3자배정",
      "신주 발행",
      "상장폐지",
      "자진 상폐",
      "액면분할",
      "스톡옵션",
      "인수합병",
    ],
    weak: [
      "실적",
      "영업이익",
      "순이익",
      "수주",
      "계약 체결",
      "지분",
      "인수",
      "합병",
      "신제품",
      "공시",
    ],
  },
};

// Latin/symbol keywords (boundary-matched), mapped to category + weight.
const REGEX_KEYWORDS: { re: RegExp; category: NewsCategory; weight: number }[] =
  [
    { re: RE_SNP, category: "global", weight: 2 },
    { re: RE_ADR, category: "global", weight: 2 },
    { re: RE_FOMC, category: "global", weight: 2 },
    { re: RE_FED, category: "global", weight: 2 },
  ];

// General finance terms marking an article stock-relevant but not, on their own,
// a category signal (per RFC: 주식/ETF/종목/투자 excluded from market).
const RELEVANCE_EXTRA = [
  "주식",
  "증권",
  "상장",
  "종목",
  "배당",
  "공시",
  "펀드",
  "레버리지",
  "공모주",
  "투자",
  "수익률",
  "자산운용",
  "주주",
  "지분",
  "매수",
  "매도",
  "코인",
  "가상자산",
  "폭락장",
  "급등락",
  "유망주",
];

const CATEGORIES: NewsCategory[] = [
  "market",
  "sector",
  "global",
  "other",
  "company",
];

// Relevance signals ⊇ every category keyword (invariant: classification ⊆
// relevance), so any article that earns a category label is never dropped.
const buildRelevanceSignals = (): string[] => {
  const signals = new Set<string>(RELEVANCE_EXTRA);
  for (const category of CATEGORIES) {
    for (const w of CATEGORY_KEYWORDS[category].strong) {
      signals.add(w);
    }
    for (const w of CATEGORY_KEYWORDS[category].weak) {
      signals.add(w);
    }
  }
  return [...signals];
};
const RELEVANCE_SIGNALS = buildRelevanceSignals();
const RELEVANCE_LATIN = [RE_ETF, RE_ADR, RE_FOMC, RE_FED, RE_SNP];

const T_ASSIGN = 2;
const MAX_LABELS = 3;
const COMPANY_STOCK_BONUS = 2;
// Primary is chosen only among tabbed categories — company has no dedicated tab,
// so it never becomes the single label (an article's best *tabbed* angle wins,
// else it falls to "all" only). market is the broadest bucket, so it loses ties
// to more specific ones. company still scores for future multi-label use.
const PRIORITY: NewsCategory[] = ["other", "sector", "global", "market"];

export interface ClassifyInput {
  content?: string | null;
  description: string;
  stockCode?: string | null;
  title: string;
}

const normalizeText = (value: string): string =>
  value.replace(RE_STRIP_CORP, " ").toLowerCase();

// A keyword counts at most once per field: title hit ×2, body hit ×1.
const countHits = (
  title: string,
  body: string,
  words: string[],
  weight: number
): number => {
  let score = 0;
  for (const w of words) {
    if (title.includes(w)) {
      score += weight * 2;
    }
    if (body.includes(w)) {
      score += weight;
    }
  }
  return score;
};

const scoreCategory = (
  title: string,
  body: string,
  category: NewsCategory
): number => {
  const set = CATEGORY_KEYWORDS[category];
  let score =
    countHits(title, body, set.strong, 2) + countHits(title, body, set.weak, 1);
  for (const rk of REGEX_KEYWORDS) {
    if (rk.category !== category) {
      continue;
    }
    if (rk.re.test(title)) {
      score += rk.weight * 2;
    }
    if (rk.re.test(body)) {
      score += rk.weight;
    }
  }
  return score;
};

/**
 * Classifies an article by its text. Returns the labels at or above the
 * assignment threshold (multi-label, capped) plus the raw per-category scores.
 */
export const classifyArticle = (
  input: ClassifyInput
): { categories: NewsCategory[]; scores: Record<NewsCategory, number> } => {
  const title = normalizeText(input.title);
  const body = normalizeText(`${input.description} ${input.content ?? ""}`);
  const scores: Record<NewsCategory, number> = {
    market: 0,
    sector: 0,
    global: 0,
    other: 0,
    company: 0,
  };
  for (const category of CATEGORIES) {
    scores[category] = scoreCategory(title, body, category);
  }
  if (input.stockCode) {
    scores.company += COMPANY_STOCK_BONUS;
  }
  const categories = CATEGORIES.filter((c) => scores[c] >= T_ASSIGN)
    .sort((a, b) => scores[b] - scores[a])
    .slice(0, MAX_LABELS);
  return { categories, scores };
};

/**
 * Collapses scores to a single primary category for the current single-column
 * schema. Highest score wins; ties break by PRIORITY. null below threshold.
 */
export const pickPrimary = (
  scores: Record<NewsCategory, number>
): NewsCategory | null => {
  let best: NewsCategory | null = null;
  let bestScore = 0;
  for (const category of PRIORITY) {
    const score = scores[category];
    if (score >= T_ASSIGN && score > bestScore) {
      best = category;
      bestScore = score;
    }
  }
  return best;
};

/**
 * Stock-relevance gate. Keeps an article when a stock is matched or any finance
 * signal appears (threshold 1 — favouring recall). Drops pure noise like an
 * unrelated crash story that only matched "주식" inside "주식회사".
 */
export const isRelevant = (input: ClassifyInput): boolean => {
  if (input.stockCode) {
    return true;
  }
  const text = normalizeText(
    `${input.title} ${input.description} ${input.content ?? ""}`
  );
  if (RELEVANCE_SIGNALS.some((w) => text.includes(w))) {
    return true;
  }
  return RELEVANCE_LATIN.some((re) => re.test(text));
};
