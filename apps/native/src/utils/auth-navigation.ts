import type { Href } from "expo-router";

const MONEYROAD_PREFIX = "/(moneyroad)";
const MAX_RETURN_TO_LENGTH = 512;
const LOOP_PATHS = new Set(["/(moneyroad)/login", "/(moneyroad)/onboarding"]);

export type MoneyRoadReturnTo = `/(moneyroad)${string}`;

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code < 32 || code === 127) {
      return true;
    }
  }
  return false;
}

function pathOnly(value: string): string {
  const queryIndex = value.indexOf("?");
  const hashIndex = value.indexOf("#");
  const indexes = [queryIndex, hashIndex].filter((index) => index >= 0);
  return indexes.length === 0 ? value : value.slice(0, Math.min(...indexes));
}

export function sanitizeReturnTo(
  value: string | string[] | undefined
): MoneyRoadReturnTo | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (
    !candidate ||
    candidate.length > MAX_RETURN_TO_LENGTH ||
    candidate.trim() !== candidate ||
    candidate.includes("\\") ||
    hasControlCharacter(candidate) ||
    !(
      candidate === MONEYROAD_PREFIX ||
      candidate.startsWith(`${MONEYROAD_PREFIX}/`)
    )
  ) {
    return null;
  }

  const path = pathOnly(candidate);
  if (LOOP_PATHS.has(path)) {
    return null;
  }

  return candidate as MoneyRoadReturnTo;
}

export function buildLoginHref(returnTo: MoneyRoadReturnTo): Href {
  return `${MONEYROAD_PREFIX}/login?returnTo=${encodeURIComponent(returnTo)}` as Href;
}
