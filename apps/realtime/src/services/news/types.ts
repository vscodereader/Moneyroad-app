export type NewsCategory = "market" | "sector" | "global" | "company" | "other";

/** Raw item as returned by the Naver news search API. */
export interface NaverNewsItem {
  description: string;
  link: string;
  originallink: string;
  pubDate: string;
  title: string;
}

/** A news row prepared for insertion (before AI enrichment is applied). */
export interface PreparedNews {
  category: string | null;
  content: string | null;
  description: string;
  id: string;
  link: string;
  originallink: string;
  pubDate: Date;
  query: string;
  source: string | null;
  sourceType: "auto";
  stockCode: string | null;
  summary: string | null;
  tags: string[];
  title: string;
}

/** Serializable news event pushed over SSE and returned by REST. */
export interface NewsEvent {
  category: string | null;
  createdAt: string;
  description: string;
  id: string;
  link: string | null;
  pubDate: string;
  query: string | null;
  source: string | null;
  stockCode: string | null;
  summary: string | null;
  tags: string[] | null;
  title: string;
}

/** Which news a client wants over SSE. */
export interface NewsFilter {
  /** True when the client requested no filter and wants every new item. */
  all: boolean;
  categories: Set<string>;
  symbols: Set<string>;
}
