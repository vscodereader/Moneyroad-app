const FALLBACK_VERSION = "알 수 없음";

export function formatAppVersionLabel(
  version: string | null | undefined
): string {
  const trimmedVersion = version?.trim();

  return `버전 ${trimmedVersion || FALLBACK_VERSION}`;
}
