// HTML/entity cleanup for Naver news titles and bodies. Pure functions, no deps.

const HTML_TAG_RE = /<[^>]*>/g;
const HTML_BLOCK_BREAK_RE = /<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi;
const WHITESPACE_RE = /[ \t\r\n]+/g;
const HTML_ENTITY_RE = /&(#\d+|#x[\da-f]+|[a-z]+);/gi;
const MAX_UNICODE_CODE_POINT = 0x10_ff_ff;

const htmlEntities: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
} as const;

function decodeHtmlEntity(entity: string): string {
  const normalized = entity.toLowerCase();
  if (normalized.startsWith("#x")) {
    const codePoint = Number.parseInt(normalized.slice(2), 16);
    return Number.isNaN(codePoint) || codePoint > MAX_UNICODE_CODE_POINT
      ? `&${entity};`
      : String.fromCodePoint(codePoint);
  }
  if (normalized.startsWith("#")) {
    const codePoint = Number.parseInt(normalized.slice(1), 10);
    return Number.isNaN(codePoint) || codePoint > MAX_UNICODE_CODE_POINT
      ? `&${entity};`
      : String.fromCodePoint(codePoint);
  }
  return htmlEntities[normalized] ?? `&${entity};`;
}

export function decodeHtmlEntities(text: string): string {
  return text.replace(HTML_ENTITY_RE, (_match, entity: string) =>
    decodeHtmlEntity(entity)
  );
}

export function stripHtml(text: string): string {
  return decodeHtmlEntities(text.replace(HTML_TAG_RE, ""));
}

export function parseNewsTitle(text: string): string {
  return stripHtml(text).replace(WHITESPACE_RE, " ").trim();
}

export function parseNewsBody(text: string): string {
  const withBreaks = text.replace(HTML_BLOCK_BREAK_RE, "\n");
  const withoutTags = stripHtml(withBreaks);
  return withoutTags
    .split("\n")
    .map((line) => line.replace(WHITESPACE_RE, " ").trim())
    .filter(Boolean)
    .join("\n\n");
}
