// MoneyRoad — shared settings layout primitives + interactive slider

import { useRef } from "react";
import { PanResponder, Pressable, ScrollView, Text, View } from "react-native";

import { BackButton, MrHeader, MrScreen } from "./components";
import { nav } from "./nav";
import { useMrTheme } from "./theme";

export function SettingsScreen({
  title,
  children,
  right,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <MrScreen>
      <MrHeader
        left={<BackButton onPress={nav.back} />}
        right={right}
        title={title}
      />
      <ScrollView showsVerticalScrollIndicator={false}>{children}</ScrollView>
    </MrScreen>
  );
}

export function SettingsGroup({
  label,
  sublabel,
  children,
}: {
  label?: string;
  sublabel?: string;
  children: React.ReactNode;
}) {
  const { t } = useMrTheme();
  return (
    <View style={{ paddingTop: 14 }}>
      {label ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 6 }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: "800",
              color: t.fgMuted,
              letterSpacing: 0.3,
            }}
          >
            {label}
          </Text>
          {sublabel ? (
            <Text style={{ fontSize: 11, color: t.fgSubtle, marginTop: 2 }}>
              {sublabel}
            </Text>
          ) : null}
        </View>
      ) : null}
      <View>{children}</View>
    </View>
  );
}

export function SettingsRow({
  label,
  sub,
  right,
  onPress,
  danger,
}: {
  label: React.ReactNode;
  sub?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
}) {
  const { t } = useMrTheme();
  return (
    <Pressable
      android_ripple={onPress ? { color: t.bgSubtle } : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: t.bg,
        borderBottomWidth: 1,
        borderBottomColor: t.border,
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        {typeof label === "string" ? (
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: danger ? t.downStrong : t.fgStrong,
            }}
          >
            {label}
          </Text>
        ) : (
          label
        )}
        {sub ? (
          <Text style={{ fontSize: 12, color: t.fgMuted, marginTop: 2 }}>
            {sub}
          </Text>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

// Lightweight draggable slider (PanResponder-based, dependency-free).
export function Slider({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const { t } = useMrTheme();
  const widthRef = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => updateFromX(e.nativeEvent.locationX),
      onPanResponderMove: (e) => updateFromX(e.nativeEvent.locationX),
    })
  ).current;

  function updateFromX(x: number) {
    const w = widthRef.current || 1;
    const ratio = Math.max(0, Math.min(1, x / w));
    onChangeRef.current(Math.round(min + ratio * (max - min)));
  }

  const pct = ((value - min) / (max - min)) * 100;
  return (
    <View
      onLayout={(e) => {
        widthRef.current = e.nativeEvent.layout.width;
      }}
      style={{ height: 28, justifyContent: "center" }}
      {...responder.panHandlers}
    >
      <View style={{ height: 6, borderRadius: 3, backgroundColor: t.bgMuted }}>
        <View
          style={{
            width: `${pct}%`,
            height: 6,
            borderRadius: 3,
            backgroundColor: t.primary,
          }}
        />
      </View>
      <View
        style={{
          position: "absolute",
          left: `${pct}%`,
          marginLeft: -10,
          width: 20,
          height: 20,
          borderRadius: 999,
          backgroundColor: "#fff",
          borderWidth: 2,
          borderColor: t.primary,
        }}
      />
    </View>
  );
}
