// MoneyRoad — chart & graphic primitives (react-native-svg)

import { useId } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  LinearGradient,
  Path,
  Polyline,
  Rect,
  Stop,
} from "react-native-svg";

import { type MrTokens, signalMeta } from "@/utils/theme";

// ── Sparkline (tiny inline chart) ──────────────────────────────
export function Sparkline({
  data,
  width = 64,
  height = 24,
  positive,
  t,
}: {
  data: number[];
  width?: number;
  height?: number;
  positive: boolean;
  t: MrTokens;
}) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 2) - 1;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const color = positive ? t.upStrong : t.downStrong;
  const lastX = width;
  const lastY =
    height - (((data.at(-1) as number) - min) / range) * (height - 2) - 1;
  return (
    <Svg height={height} viewBox={`0 0 ${width} ${height}`} width={width}>
      <Polyline
        fill="none"
        points={points}
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
      />
      <Circle cx={lastX} cy={lastY} fill={color} r={2} />
    </Svg>
  );
}

// ── Index intraday chart (full session vs previous close) ─────
// Fixed x-axis over the trading session; dashed baseline at the previous close;
// area above the baseline filled red (up), below filled blue (down) — Korean
// market convention. Points are { m: minutes-since-open, v: index value }.
const INTRADAY_PAD_Y = 2;
const SAFE_ID = /[^a-zA-Z0-9]/g;

export function IndexIntradayChart({
  series,
  prevClose,
  sessionMinutes,
  width = 56,
  height = 28,
  t,
}: {
  series: { m: number; v: number }[];
  prevClose: number;
  sessionMinutes: number;
  width?: number;
  height?: number;
  t: MrTokens;
}) {
  const rawId = useId();
  const id = `idx${rawId.replace(SAFE_ID, "")}`;

  const values = series.map((p) => p.v);
  if (prevClose > 0) {
    values.push(prevClose);
  }
  const max = values.length > 0 ? Math.max(...values) : 1;
  const min = values.length > 0 ? Math.min(...values) : 0;
  const range = max - min || 1;

  const xAt = (m: number) =>
    Math.max(0, Math.min(width, (m / sessionMinutes) * width));
  const yAt = (v: number) =>
    INTRADAY_PAD_Y + (height - INTRADAY_PAD_Y * 2) * (1 - (v - min) / range);

  const baselineY = yAt(prevClose);
  const up = (series.at(-1)?.v ?? prevClose) >= prevClose;
  const lineColor = up ? t.upStrong : t.downStrong;

  const pts = series.map((p) => [xAt(p.m), yAt(p.v)] as const);
  const linePath = pts
    .map(
      (p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(2)} ${p[1].toFixed(2)}`
    )
    .join(" ");
  const first = pts[0];
  const last = pts.at(-1);
  const areaPath =
    first && last
      ? `${linePath} L${last[0].toFixed(2)} ${baselineY.toFixed(2)} L${first[0].toFixed(2)} ${baselineY.toFixed(2)} Z`
      : "";

  return (
    <Svg height={height} viewBox={`0 0 ${width} ${height}`} width={width}>
      <Defs>
        <ClipPath id={`${id}up`}>
          <Rect height={baselineY} width={width} x={0} y={0} />
        </ClipPath>
        <ClipPath id={`${id}down`}>
          <Rect height={height - baselineY} width={width} x={0} y={baselineY} />
        </ClipPath>
      </Defs>
      {areaPath ? (
        <Path
          clipPath={`url(#${id}up)`}
          d={areaPath}
          fill={t.upBg}
          opacity={0.7}
        />
      ) : null}
      {areaPath ? (
        <Path
          clipPath={`url(#${id}down)`}
          d={areaPath}
          fill={t.downBg}
          opacity={0.7}
        />
      ) : null}
      <Path
        d={`M0 ${baselineY.toFixed(2)} L${width} ${baselineY.toFixed(2)}`}
        stroke={t.fgSubtle}
        strokeDasharray="2 2"
        strokeWidth={0.75}
      />
      {linePath ? (
        <Path
          d={linePath}
          fill="none"
          stroke={lineColor}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
        />
      ) : null}
      {last ? (
        <Circle cx={last[0]} cy={last[1]} fill={lineColor} r={1.5} />
      ) : null}
    </Svg>
  );
}

// ── Stock chart (line + area, grid, last marker) ──────────────
export function StockChart({
  data,
  positive,
  height = 200,
  width = 360,
  t,
}: {
  data: number[];
  positive: boolean;
  height?: number;
  width?: number;
  t: MrTokens;
}) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const PADX = 8;
  const PADY = 12;
  const w = width - PADX * 2;
  const h = height - PADY * 2;
  const pts = data.map((v, i) => {
    const x = PADX + (i / (data.length - 1)) * w;
    const y = PADY + h - ((v - min) / range) * h;
    return [x, y] as const;
  });
  const linePath = pts
    .map(
      (p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(2)} ${p[1].toFixed(2)}`
    )
    .join(" ");
  const lastPt = pts.at(-1) as readonly [number, number];
  const firstPt = pts[0];
  const areaPath = `${linePath} L${lastPt[0]} ${PADY + h} L${firstPt[0]} ${PADY + h} Z`;
  const color = positive ? t.upStrong : t.downStrong;
  const fill = positive ? t.upBg : t.downBg;
  return (
    <Svg height={height} viewBox={`0 0 ${width} ${height}`} width={width}>
      {[0.25, 0.5, 0.75].map((tick) => (
        <Path
          d={`M${PADX} ${PADY + h * tick} L${width - PADX} ${PADY + h * tick}`}
          key={tick}
          stroke={t.border}
          strokeDasharray="2 4"
          strokeWidth={1}
        />
      ))}
      <Path d={areaPath} fill={fill} opacity={0.6} />
      <Path
        d={linePath}
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
      <Circle cx={lastPt[0]} cy={lastPt[1]} fill={color} opacity={0.18} r={8} />
      <Circle cx={lastPt[0]} cy={lastPt[1]} fill={color} r={4} />
    </Svg>
  );
}

// ── Signal dial (composite score, 4-segment ring) ─────────────
function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number
) {
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M${s.x} ${s.y} A${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

export function SignalDial({
  breakdown,
  size = 132,
  t,
}: {
  breakdown: { tech: number; ai: number; event: number; community: number };
  size?: number;
  t: MrTokens;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 12;
  const STROKE = 8;
  const GAP = 5;
  const quarter = 90 - GAP;
  const meta = signalMeta(t);
  const segs = [
    { key: "tech", val: breakdown.tech, color: meta.tech.color },
    { key: "ai", val: breakdown.ai, color: meta.ai.color },
    { key: "event", val: breakdown.event, color: meta.event.color },
    { key: "community", val: breakdown.community, color: meta.community.color },
  ];
  return (
    <Svg height={size} viewBox={`0 0 ${size} ${size}`} width={size}>
      <G transform={`rotate(-90 ${cx} ${cy})`}>
        {segs.map((s, i) => {
          const start = i * 90 + GAP / 2;
          const end = start + quarter;
          const valEnd = start + (s.val / 100) * quarter;
          return (
            <G key={s.key}>
              <Path
                d={arcPath(cx, cy, R, start, end)}
                fill="none"
                stroke={t.bgMuted}
                strokeLinecap="round"
                strokeWidth={STROKE}
              />
              <Path
                d={arcPath(cx, cy, R, start, valEnd)}
                fill="none"
                stroke={s.color}
                strokeLinecap="round"
                strokeWidth={STROKE}
              />
            </G>
          );
        })}
      </G>
    </Svg>
  );
}

// ── Linear gradient background (fills its container) ──────────
export function Gradient({
  colors,
  style,
  borderRadius,
  children,
}: {
  colors: string[];
  style?: ViewStyle | ViewStyle[];
  borderRadius?: number;
  children?: React.ReactNode;
}) {
  const rawId = useId();
  const id = `grad${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <View
      style={[
        style,
        borderRadius == null ? null : { borderRadius, overflow: "hidden" },
      ]}
    >
      <Svg height="100%" style={StyleSheet.absoluteFill} width="100%">
        <Defs>
          <LinearGradient id={id} x1="0" x2="1" y1="0" y2="1">
            {colors.map((c, i) => (
              <Stop
                key={c + String(i)}
                offset={colors.length === 1 ? 0 : i / (colors.length - 1)}
                stopColor={c}
              />
            ))}
          </LinearGradient>
        </Defs>
        <Rect fill={`url(#${id})`} height="100%" width="100%" x="0" y="0" />
      </Svg>
      {children}
    </View>
  );
}
