// MoneyRoad — shared UI atoms

import { useEffect } from "react";
import {
  Pressable,
  type StyleProp,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Stock } from "./data";
import { Icon, type IconProps } from "./icons";
import { type MrTokens, useMrTheme } from "./theme";

// ── Screen container ──────────────────────────────────────────
export function MrScreen({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useMrTheme();
  return (
    <View style={[{ flex: 1, backgroundColor: t.bg }, style]}>{children}</View>
  );
}

// ── Round icon button (header actions) ────────────────────────
export function IconButton({
  onPress,
  children,
  dot,
  size = 36,
}: {
  onPress?: () => void;
  children: React.ReactNode;
  dot?: boolean;
  size?: number;
}) {
  const { t } = useMrTheme();
  return (
    <Pressable
      android_ripple={{ color: t.bgMuted, borderless: true }}
      hitSlop={6}
      onPress={onPress}
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 999,
      }}
    >
      {children}
      {dot ? (
        <View
          style={{
            position: "absolute",
            top: 7,
            right: 8,
            width: 7,
            height: 7,
            borderRadius: 999,
            backgroundColor: t.upStrong,
            borderWidth: 1.5,
            borderColor: t.bg,
          }}
        />
      ) : null}
    </Pressable>
  );
}

// ── Header (top app bar) ──────────────────────────────────────
export function MrHeader({
  left,
  title,
  right,
}: {
  left?: React.ReactNode;
  title?: React.ReactNode;
  right?: React.ReactNode;
}) {
  const { t } = useMrTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingTop: insets.top + 8,
        paddingBottom: 12,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: t.bg,
        borderBottomWidth: 1,
        borderBottomColor: t.border,
      }}
    >
      {left}
      <View style={{ flex: 1 }}>
        {typeof title === "string" ? (
          <Text
            style={{
              fontSize: 22,
              fontWeight: "800",
              letterSpacing: -0.3,
              color: t.fgStrong,
            }}
          >
            {title}
          </Text>
        ) : (
          title
        )}
      </View>
      <View style={{ flexDirection: "row", gap: 4 }}>{right}</View>
    </View>
  );
}

export function BackButton({ onPress }: { onPress: () => void }) {
  const { t } = useMrTheme();
  return (
    <IconButton onPress={onPress}>
      <Icon.chevLeft color={t.fgStrong} size={24} />
    </IconButton>
  );
}

// ── Section header (title + "more") ───────────────────────────
export function SectionHead({
  title,
  more,
  onMore,
}: {
  title: string;
  more?: string;
  onMore?: () => void;
}) {
  const { t } = useMrTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "baseline",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingTop: 18,
        paddingBottom: 8,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: "800", color: t.fgStrong }}>
        {title}
      </Text>
      {more ? (
        <Pressable onPress={onMore}>
          <Text style={{ fontSize: 13, color: t.fgMuted, fontWeight: "500" }}>
            {more}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ── Stock logo (initial badge) ────────────────────────────────
export function StockLogo({
  stock,
  size = 40,
  radius = 10,
}: {
  stock: Stock;
  size?: number;
  radius?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: stock.color,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontSize: size > 32 ? 14 : 12,
          fontWeight: "800",
          color: stock.logoTxt ?? "#fff",
        }}
      >
        {stock.logo}
      </Text>
    </View>
  );
}

// ── Strength bar (1-5 squares) ────────────────────────────────
export function StrengthBar({
  value,
  color,
}: {
  value: number;
  color: string;
}) {
  const { t } = useMrTheme();
  return (
    <View style={{ flexDirection: "row", gap: 3, height: 6 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View
          key={i}
          style={{
            flex: 1,
            borderRadius: 3,
            backgroundColor: i <= value ? color : t.bgMuted,
          }}
        />
      ))}
    </View>
  );
}

// ── Signal score pill ─────────────────────────────────────────
function scorePillColors(
  score: number,
  t: MrTokens
): { bg: string; fg: string } {
  if (score >= 70) {
    return { bg: t.upBg, fg: t.upStrong };
  }
  if (score < 50) {
    return { bg: t.downBg, fg: t.downStrong };
  }
  return { bg: t.bgMuted, fg: t.fgStrong };
}

export function ScorePill({ score }: { score: number }) {
  const { t } = useMrTheme();
  const { bg, fg } = scorePillColors(score, t);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        height: 22,
        paddingLeft: 6,
        paddingRight: 8,
        borderRadius: 999,
        backgroundColor: bg,
      }}
    >
      <View
        style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: fg }}
      />
      <Text style={{ fontSize: 11, fontWeight: "800", color: fg }}>
        시그널 {score}
      </Text>
    </View>
  );
}

// ── Filter chip ───────────────────────────────────────────────
export function Chip({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count?: number;
  active: boolean;
  onPress: () => void;
}) {
  const { t } = useMrTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        height: 32,
        paddingHorizontal: 12,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? t.fgStrong : t.borderStrong,
        backgroundColor: active ? t.fgStrong : t.bg,
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
      }}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: "600",
          color: active ? t.bg : t.fgMuted,
        }}
      >
        {label}
      </Text>
      {count == null ? null : (
        <Text
          style={{
            fontSize: 11,
            fontWeight: "700",
            opacity: 0.7,
            color: active ? t.bg : t.fgMuted,
          }}
        >
          {count}
        </Text>
      )}
    </Pressable>
  );
}

// ── iOS-style switch ──────────────────────────────────────────
export function Switch({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  const { t } = useMrTheme();
  const offset = useSharedValue(on ? 18 : 0);
  useEffect(() => {
    offset.value = withTiming(on ? 18 : 0, { duration: 180 });
  }, [on, offset]);
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));
  return (
    <Pressable
      hitSlop={6}
      onPress={() => onChange(!on)}
      style={{
        width: 44,
        height: 26,
        borderRadius: 999,
        padding: 2,
        backgroundColor: on ? t.primary : t.borderStrong,
      }}
    >
      <Animated.View
        style={[
          {
            width: 22,
            height: 22,
            borderRadius: 999,
            backgroundColor: "#fff",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.2,
            shadowRadius: 3,
            elevation: 2,
          },
          thumbStyle,
        ]}
      />
    </Pressable>
  );
}

// ── Segmented control ─────────────────────────────────────────
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { t } = useMrTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        padding: 2,
        borderRadius: 8,
        backgroundColor: t.bgMuted,
        gap: 2,
      }}
    >
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 6,
              minWidth: 44,
              alignItems: "center",
              backgroundColor: selected ? t.bg : "transparent",
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: selected ? t.fgStrong : t.fgMuted,
              }}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Small reusable badge/tag ──────────────────────────────────
export function Tag({
  label,
  bg,
  color,
}: {
  label: string;
  bg: string;
  color: string;
}) {
  return (
    <View
      style={{
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
        backgroundColor: bg,
      }}
    >
      <Text style={{ fontSize: 10, fontWeight: "800", color }}>{label}</Text>
    </View>
  );
}

// ── AI summary chip (gradient pill) ───────────────────────────
export function AiChip({ label = "AI 요약" }: { label?: string }) {
  const { t } = useMrTheme();
  // Approximate the gradient with a mid blend; full gradient lives in cards.
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        height: 22,
        paddingHorizontal: 8,
        borderRadius: 999,
        backgroundColor: t.sigAi,
      }}
    >
      <Icon.sparkles color="#fff" size={11} />
      <Text style={{ fontSize: 11, fontWeight: "700", color: "#fff" }}>
        {label}
      </Text>
    </View>
  );
}

export type IconComponent = (props: IconProps) => React.JSX.Element;
