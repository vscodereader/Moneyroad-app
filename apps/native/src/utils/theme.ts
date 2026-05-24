// MoneyRoad — KRDS-derived theme tokens (light/dark)
// Korean market color convention: up = red, down = blue.
// Ported from the design prototype's CSS custom properties (styles.css).

export interface MrTokens {
  // surfaces
  bg: string;
  bgElev: string;
  bgInverse: string;
  bgMuted: string;
  bgSubtle: string;
  // borders
  border: string;
  borderStrong: string;
  down: string;
  downBg: string;
  downStrong: string;
  // text
  fg: string;
  fgMuted: string;
  fgOnAccent: string;
  fgStrong: string;
  fgSubtle: string;
  neutral: string;
  neutralBg: string;
  // brand
  primary: string;
  primaryHover: string;
  primaryOn: string;
  primarySubtle: string;
  sigAi: string;
  // signal AI subtle background (used for chips/icons)
  sigAiBg: string;
  sigCommunity: string;
  sigEvent: string;
  // signal segment colors
  sigTech: string;
  success: string;
  successBg: string;
  // Korean market colors
  up: string;
  upBg: string;
  upStrong: string;
  // semantic
  warning: string;
  warningBg: string;
}

export const lightTokens: MrTokens = {
  bg: "#FFFFFF",
  bgElev: "#FFFFFF",
  bgSubtle: "#F4F5F6",
  bgMuted: "#ECEEF1",
  bgInverse: "#1E2124",

  fg: "#131416",
  fgStrong: "#1E2124",
  fgMuted: "#58616A",
  fgSubtle: "#8A949E",
  fgOnAccent: "#FFFFFF",

  border: "#E6E8EA",
  borderStrong: "#CDD1D5",

  primary: "#256EF4",
  primaryHover: "#0B50D0",
  primarySubtle: "#ECF2FE",
  primaryOn: "#FFFFFF",

  up: "#E0494C",
  upStrong: "#D6212F",
  upBg: "#FBEFEF",
  down: "#256EF4",
  downStrong: "#0B50D0",
  downBg: "#ECF2FE",
  neutral: "#6D7882",
  neutralBg: "#F4F5F6",

  warning: "#C97A0A",
  warningBg: "#FDF5E6",
  success: "#198043",
  successBg: "#E6F4EC",

  sigTech: "#256EF4",
  sigAi: "#6A4DD6",
  sigEvent: "#C97A0A",
  sigCommunity: "#198043",
  sigAiBg: "rgba(106,77,214,0.12)",
};

export const darkTokens: MrTokens = {
  bg: "#131416",
  bgElev: "#1E2124",
  bgSubtle: "#1A1C1F",
  bgMuted: "#25282C",
  bgInverse: "#FFFFFF",

  fg: "#F4F5F6",
  fgStrong: "#FFFFFF",
  fgMuted: "#B1B8BE",
  fgSubtle: "#8A949E",
  fgOnAccent: "#FFFFFF",

  border: "#2D3034",
  borderStrong: "#3A3E43",

  primary: "#4D87F5",
  primaryHover: "#80A8F7",
  primarySubtle: "#102043",
  primaryOn: "#FFFFFF",

  up: "#FF6B6E",
  upStrong: "#FF8585",
  upBg: "#2A1416",
  down: "#4D87F5",
  downStrong: "#80A8F7",
  downBg: "#0F1B36",
  neutral: "#8A949E",
  neutralBg: "#1E2124",

  warning: "#E29A1B",
  warningBg: "#2A1F08",
  success: "#1F9B5E",
  successBg: "#0A2418",

  sigTech: "#4D87F5",
  sigAi: "#9B82E8",
  sigEvent: "#E29A1B",
  sigCommunity: "#1F9B5E",
  sigAiBg: "rgba(155,130,232,0.18)",
};

// ── Signal type metadata (colors resolved against the active theme) ──
export type SignalTypeKey = "tech" | "ai" | "event" | "community";

export const SIGNAL_TYPE_KEYS: SignalTypeKey[] = [
  "tech",
  "ai",
  "event",
  "community",
];

export interface SignalTypeMeta {
  bg: string;
  color: string;
  key: SignalTypeKey;
  label: string;
}

export function signalMeta(t: MrTokens): Record<SignalTypeKey, SignalTypeMeta> {
  return {
    tech: { key: "tech", label: "기술적", color: t.sigTech, bg: t.downBg },
    ai: { key: "ai", label: "AI 모델", color: t.sigAi, bg: t.sigAiBg },
    event: {
      key: "event",
      label: "이벤트",
      color: t.sigEvent,
      bg: t.warningBg,
    },
    community: {
      key: "community",
      label: "커뮤니티",
      color: t.sigCommunity,
      bg: t.successBg,
    },
  };
}

// Primary signal classification: the suggested action. (Korean market colors:
// 매수=red/up, 매도=blue/down, 관망=neutral.)
export type SignalAction = "buy" | "sell" | "hold";

export const SIGNAL_ACTION_KEYS: SignalAction[] = ["buy", "sell", "hold"];

export interface SignalActionMeta {
  bg: string;
  color: string;
  key: SignalAction;
  label: string;
}

export function signalActionMeta(
  t: MrTokens
): Record<SignalAction, SignalActionMeta> {
  return {
    buy: { key: "buy", label: "매수", color: t.upStrong, bg: t.upBg },
    sell: { key: "sell", label: "매도", color: t.downStrong, bg: t.downBg },
    hold: { key: "hold", label: "관망", color: t.neutral, bg: t.neutralBg },
  };
}
