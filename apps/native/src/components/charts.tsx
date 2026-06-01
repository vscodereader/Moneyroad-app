// MoneyRoad — chart & graphic primitives (react-native-svg)

import { useId } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Polyline,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";

import {
  type ChartSeries,
  SESSION_MINUTES,
  type StockChartRange,
} from "@/hooks/use-stock-chart";
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

// ── Stock chart (price + volume, grid, prev-close baseline) ───
// Layout: 가격 영역(상단 ~74%) + 거래량 영역(하단 ~26%), 좌측에 Y축 라벨 컬럼.
// 1D는 X축을 09:00~15:30(SESSION_MINUTES)로 고정해 우측 빈 공간이 자연스럽게
// 남도록 하고, 그 외 range는 0..points.length-1을 가득 채운다.
const TICK_TARGET = 5;
const PRICE_AREA_FRAC = 0.74;
const PAD_LEFT = 48;
const PAD_RIGHT = 8;
const PAD_TOP = 8;
const PAD_BOTTOM = 22;
const AXIS_LABEL_FONT = 10;
const VOLUME_GAP = 4;

function niceStep(span: number): number {
  if (span <= 0) {
    return 1;
  }
  const rough = span / TICK_TARGET;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const norm = rough / mag;
  let nice = 10;
  if (norm < 1.5) {
    nice = 1;
  } else if (norm < 3) {
    nice = 2;
  } else if (norm < 7) {
    nice = 5;
  }
  return nice * mag;
}

function priceTicks(min: number, max: number): number[] {
  const step = niceStep(max - min);
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + 0.5 * step; v += step) {
    ticks.push(Math.round(v));
  }
  return ticks;
}

function formatPrice(v: number): string {
  return Math.round(v).toLocaleString("ko-KR");
}

// 1D X축 분 좌표 → "10:00" 라벨. 0=09:00.
const DAY_X_LABELS: { t: number; label: string }[] = [
  { t: 60, label: "10:00" },
  { t: 180, label: "12:00" },
  { t: 300, label: "14:00" },
];

interface Scale {
  toX: (t: number) => number;
  toY: (v: number) => number;
  xMax: number;
  xMin: number;
}

function buildScale(
  series: ChartSeries,
  range: StockChartRange,
  priceMin: number,
  priceMax: number,
  bounds: { left: number; right: number; top: number; bottom: number }
): Scale {
  const xMin = 0;
  const xMax =
    range === "1D" ? SESSION_MINUTES : Math.max(1, series.points.length - 1);
  const span = priceMax - priceMin || 1;
  return {
    xMin,
    xMax,
    toX: (t) =>
      bounds.left + ((t - xMin) / (xMax - xMin)) * (bounds.right - bounds.left),
    toY: (v) =>
      bounds.top + ((priceMax - v) / span) * (bounds.bottom - bounds.top),
  };
}

export function StockChart({
  series,
  range,
  positive,
  height = 220,
  width = 360,
  t,
}: {
  series: ChartSeries;
  range: StockChartRange;
  positive: boolean;
  height?: number;
  width?: number;
  t: MrTokens;
}) {
  const { points, prevClose } = series;
  const priceH = (height - PAD_TOP - PAD_BOTTOM) * PRICE_AREA_FRAC;
  const volH =
    (height - PAD_TOP - PAD_BOTTOM) * (1 - PRICE_AREA_FRAC) - VOLUME_GAP;
  const priceTop = PAD_TOP;
  const priceBottom = PAD_TOP + priceH;
  const volTop = priceBottom + VOLUME_GAP;
  const volBottom = volTop + volH;
  const left = PAD_LEFT;
  const right = width - PAD_RIGHT;

  // Y축 가격 범위: 데이터의 min/max에 prevClose도 포함시켜 기준선이 차트에 들어오게.
  const values = points.map((p) => p.v);
  const dataMin = values.length > 0 ? Math.min(...values) : 0;
  const dataMax = values.length > 0 ? Math.max(...values) : 1;
  const baseMin = prevClose > 0 ? Math.min(dataMin, prevClose) : dataMin;
  const baseMax = prevClose > 0 ? Math.max(dataMax, prevClose) : dataMax;
  const ticks = priceTicks(baseMin, baseMax);
  const priceMin = ticks[0] ?? baseMin;
  const priceMax = ticks.at(-1) ?? baseMax;

  const scale = buildScale(series, range, priceMin, priceMax, {
    left,
    right,
    top: priceTop,
    bottom: priceBottom,
  });

  const pts = points.map((p) => [scale.toX(p.t), scale.toY(p.v)] as const);
  const linePath = pts
    .map(
      (p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(2)} ${p[1].toFixed(2)}`
    )
    .join(" ");
  const lastPt = pts.at(-1);
  const firstPt = pts[0];
  const areaPath =
    pts.length > 1 && firstPt && lastPt
      ? `${linePath} L${lastPt[0].toFixed(2)} ${priceBottom} L${firstPt[0].toFixed(2)} ${priceBottom} Z`
      : null;

  const lineColor = positive ? t.upStrong : t.downStrong;
  const areaColor = positive ? t.upBg : t.downBg;
  const volMax = points.reduce((m, p) => (p.vol > m ? p.vol : m), 0) || 1;
  const barW = Math.max(
    1,
    ((right - left) / Math.max(1, scale.xMax - scale.xMin)) * 0.7
  );

  return (
    <Svg height={height} viewBox={`0 0 ${width} ${height}`} width={width}>
      {/* 가로 그리드 + Y축 가격 라벨 */}
      {ticks.map((tick) => {
        const y = scale.toY(tick);
        return (
          <G key={tick}>
            <Line
              stroke={t.border}
              strokeWidth={1}
              x1={left}
              x2={right}
              y1={y}
              y2={y}
            />
            <SvgText
              fill={t.fgSubtle}
              fontSize={AXIS_LABEL_FONT}
              textAnchor="end"
              x={left - 6}
              y={y + AXIS_LABEL_FONT / 2 - 1}
            >
              {formatPrice(tick)}
            </SvgText>
          </G>
        );
      })}

      {/* 전일 종가 점선 (1D만 의미) */}
      {range === "1D" && prevClose > 0 ? (
        <Line
          stroke={t.fgMuted}
          strokeDasharray="2 3"
          strokeWidth={1}
          x1={left}
          x2={right}
          y1={scale.toY(prevClose)}
          y2={scale.toY(prevClose)}
        />
      ) : null}

      {/* 면 + 라인 + 마지막 마커 */}
      {areaPath ? <Path d={areaPath} fill={areaColor} opacity={0.55} /> : null}
      {pts.length > 1 ? (
        <Path
          d={linePath}
          fill="none"
          stroke={lineColor}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
        />
      ) : null}
      {lastPt ? (
        <>
          <Circle
            cx={lastPt[0]}
            cy={lastPt[1]}
            fill={lineColor}
            opacity={0.18}
            r={6}
          />
          <Circle cx={lastPt[0]} cy={lastPt[1]} fill={lineColor} r={3} />
        </>
      ) : null}

      {/* 가격/거래량 영역 구분선 */}
      <Line
        stroke={t.border}
        strokeWidth={1}
        x1={left}
        x2={right}
        y1={priceBottom}
        y2={priceBottom}
      />

      {/* 거래량 바 */}
      {points.map((p) => {
        const x = scale.toX(p.t);
        const h = volH * (p.vol / volMax) * 0.9;
        return (
          <Rect
            fill={t.fgSubtle}
            height={h}
            key={`vol-${p.t}`}
            opacity={0.55}
            width={barW}
            x={x - barW / 2}
            y={volBottom - h}
          />
        );
      })}

      {/* 거래량 영역 바닥선 */}
      <Line
        stroke={t.border}
        strokeWidth={1}
        x1={left}
        x2={right}
        y1={volBottom}
        y2={volBottom}
      />

      {/* X축 라벨 (1D만 시간) */}
      {range === "1D"
        ? DAY_X_LABELS.map((label) => (
            <SvgText
              fill={t.fgSubtle}
              fontSize={AXIS_LABEL_FONT}
              key={label.t}
              textAnchor="middle"
              x={scale.toX(label.t)}
              y={height - 6}
            >
              {label.label}
            </SvgText>
          ))
        : null}
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
