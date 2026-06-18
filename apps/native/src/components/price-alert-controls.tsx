import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import { Icon } from "@/components/icons";
import { SegmentedControl, Switch } from "@/components/ui";
import { useMrTheme } from "@/hooks/use-mr-theme";
import { changeColor, fmt } from "@/utils/format";
import { orpc } from "@/utils/orpc";
import type { MrTokens } from "@/utils/theme";

type Direction = "above" | "below";

// 현재가 기준 ±% 빠른 설정 프리셋. 위쪽(이상)은 호가 단위로 올림, 아래쪽(이하)은
// 내림해 "최소 +x% / 최대 -x%" 의미가 자연스럽게 맞도록 한다.
const PRESET_PCTS = [3, 1, -1, -3] as const;

const DIRECTION_OPTIONS: { value: Direction; label: string }[] = [
  { value: "above", label: "이상" },
  { value: "below", label: "이하" },
];

// 국내 주식 호가 단위 근사(2023 개편 이전 표 기준). 프리셋 가격을 보기 좋은
// 단위로 떨어뜨리는 용도라 정밀할 필요는 없다.
function tickSize(price: number): number {
  if (price < 2000) {
    return 1;
  }
  if (price < 5000) {
    return 5;
  }
  if (price < 20_000) {
    return 10;
  }
  if (price < 50_000) {
    return 50;
  }
  if (price < 200_000) {
    return 100;
  }
  if (price < 500_000) {
    return 500;
  }
  return 1000;
}

function roundToTick(price: number, dir: "up" | "down"): number {
  const tick = tickSize(price);
  const q = price / tick;
  return (dir === "up" ? Math.ceil(q) : Math.floor(q)) * tick;
}

interface Preset {
  direction: Direction;
  pct: number;
  targetPrice: number;
}

function buildPresets(currentPrice: number): Preset[] {
  const seen = new Set<string>();
  const presets: Preset[] = [];
  for (const pct of PRESET_PCTS) {
    const direction: Direction = pct >= 0 ? "above" : "below";
    const raw = currentPrice * (1 + pct / 100);
    const targetPrice = roundToTick(raw, pct >= 0 ? "up" : "down");
    const dedupeKey = `${direction}:${targetPrice}`;
    if (targetPrice <= 0 || seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);
    const realPct = ((targetPrice - currentPrice) / currentPrice) * 100;
    presets.push({ direction, pct: realPct, targetPrice });
  }
  return presets;
}

function digitsOnly(value: string): number {
  const n = Number(value.replace(/[^0-9]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

// 현재가 대비 등락률을 화면 표기용 문자열로(소수 1자리, 0 방향으로 버림).
function relPctLabel(targetPrice: number, currentPrice: number): string {
  if (currentPrice <= 0) {
    return "";
  }
  const pct = ((targetPrice - currentPrice) / currentPrice) * 100;
  const v = Math.trunc(pct * 10) / 10;
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function AlertRow({
  currentPrice,
  isOn,
  onChange,
  t,
  targetPrice,
}: {
  currentPrice: number;
  isOn: boolean;
  onChange: (next: boolean) => void;
  t: MrTokens;
  targetPrice: number;
}) {
  const pctLabel = relPctLabel(targetPrice, currentPrice);
  const pctColor = changeColor(targetPrice - currentPrice, t);
  return (
    <View
      style={{
        alignItems: "center",
        flexDirection: "row",
        gap: 12,
        paddingHorizontal: 20,
        paddingVertical: 14,
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: t.fgStrong, fontSize: 19, fontWeight: "800" }}>
          {fmt.price(targetPrice)}원
        </Text>
        {pctLabel ? (
          <Text style={{ fontSize: 13, fontWeight: "600", marginTop: 2 }}>
            <Text style={{ color: t.fgMuted }}>현재가 보다 </Text>
            <Text style={{ color: pctColor }}>{pctLabel}</Text>
          </Text>
        ) : null}
      </View>
      <Switch on={isOn} onChange={onChange} />
    </View>
  );
}

/**
 * 한 종목의 가격 알림 설정 UI(현재가 기준 ±% 프리셋 토글 + 직접 추가한 알림 +
 * 가격 직접 입력). 토글은 즉시 생성/삭제/재활성되며, priceAlert.list를 갱신한다.
 * stock/[code]의 슬라이드 시트와 설정 화면(price-alert-new)이 공유한다.
 * `enabled`는 알림 목록 쿼리 활성화 여부(비로그인 시 false).
 */
export function PriceAlertControls({
  currentPrice,
  enabled = true,
  stockCode,
}: {
  currentPrice: number | undefined;
  enabled?: boolean;
  stockCode: string;
}) {
  const { t } = useMrTheme();
  const queryClient = useQueryClient();

  const [manualOpen, setManualOpen] = useState(false);
  const [manualDirection, setManualDirection] = useState<Direction>("above");
  const [manualInput, setManualInput] = useState("");

  const listKey = orpc.priceAlert.list.key();
  const alertsQuery = useQuery(orpc.priceAlert.list.queryOptions({ enabled }));
  const invalidate = () => queryClient.invalidateQueries({ queryKey: listKey });
  const createMut = useMutation(
    orpc.priceAlert.create.mutationOptions({ onSuccess: invalidate })
  );
  const removeMut = useMutation(
    orpc.priceAlert.remove.mutationOptions({ onSuccess: invalidate })
  );
  const setActiveMut = useMutation(
    orpc.priceAlert.setActive.mutationOptions({ onSuccess: invalidate })
  );

  type StockAlert = NonNullable<typeof alertsQuery.data>[number];
  const alertsForStock = (alertsQuery.data ?? []).filter(
    (a) => a.stockCode === stockCode
  );
  const presets = currentPrice ? buildPresets(currentPrice) : [];

  const matchAlert = (direction: Direction, targetPrice: number) =>
    alertsForStock.find(
      (a) => a.direction === direction && a.targetPrice === targetPrice
    );

  // 토글 ON: 비활성 알림이면 재활성, 없으면 생성. OFF: 알림 삭제.
  const toggleAlert = (
    next: boolean,
    direction: Direction,
    targetPrice: number,
    existing: StockAlert | undefined
  ) => {
    if (next) {
      if (existing && !existing.active) {
        setActiveMut.mutate({ id: existing.id, active: true });
      } else if (!existing) {
        createMut.mutate({ stockCode, direction, targetPrice });
      }
      return;
    }
    if (existing) {
      removeMut.mutate({ id: existing.id });
    }
  };

  // 프리셋 가격과 겹치지 않는, 사용자가 직접 추가한 알림.
  const presetKeys = new Set(
    presets.map((p) => `${p.direction}:${p.targetPrice}`)
  );
  const customAlerts = alertsForStock.filter(
    (a) => !presetKeys.has(`${a.direction}:${a.targetPrice}`)
  );

  const manualTarget = digitsOnly(manualInput);
  const canSubmitManual = manualTarget > 0 && !createMut.isPending;
  const submitManual = () => {
    if (!canSubmitManual) {
      return;
    }
    createMut.mutate(
      { stockCode, direction: manualDirection, targetPrice: manualTarget },
      {
        onSuccess: () => {
          setManualInput("");
          setManualOpen(false);
        },
      }
    );
  };

  return (
    <>
      {/* Preset thresholds */}
      <View style={{ paddingTop: 12 }}>
        {currentPrice ? (
          presets.map((p) => {
            const existing = matchAlert(p.direction, p.targetPrice);
            return (
              <AlertRow
                currentPrice={currentPrice}
                isOn={existing?.active ?? false}
                key={`${p.direction}:${p.targetPrice}`}
                onChange={(next) =>
                  toggleAlert(next, p.direction, p.targetPrice, existing)
                }
                t={t}
                targetPrice={p.targetPrice}
              />
            );
          })
        ) : (
          <Text
            style={{
              color: t.fgSubtle,
              fontSize: 13,
              paddingHorizontal: 20,
              paddingVertical: 12,
            }}
          >
            실시간 시세가 연결되면 추천 도달가가 표시돼요. 아래에서 직접 입력할
            수 있어요.
          </Text>
        )}

        {/* Custom (user-entered) alerts not covered by presets */}
        {customAlerts.length > 0 ? (
          <View
            style={{
              borderTopColor: t.border,
              borderTopWidth: 1,
              marginTop: 4,
              paddingTop: 4,
            }}
          >
            {customAlerts.map((a) => (
              <AlertRow
                currentPrice={currentPrice ?? 0}
                isOn={a.active}
                key={a.id}
                onChange={(next) =>
                  toggleAlert(next, a.direction, a.targetPrice, a)
                }
                t={t}
                targetPrice={a.targetPrice}
              />
            ))}
          </View>
        ) : null}
      </View>

      {/* Manual price input */}
      <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
        {manualOpen ? (
          <View
            style={{
              backgroundColor: t.bgSubtle,
              borderRadius: 12,
              gap: 10,
              padding: 14,
            }}
          >
            <SegmentedControl
              onChange={setManualDirection}
              options={DIRECTION_OPTIONS}
              value={manualDirection}
            />
            <View
              style={{ alignItems: "center", flexDirection: "row", gap: 8 }}
            >
              <View
                style={{
                  alignItems: "center",
                  backgroundColor: t.bg,
                  borderRadius: 10,
                  flex: 1,
                  flexDirection: "row",
                  height: 48,
                  paddingHorizontal: 14,
                }}
              >
                <TextInput
                  autoFocus
                  keyboardType="number-pad"
                  onChangeText={setManualInput}
                  placeholder="도달가 입력"
                  placeholderTextColor={t.fgSubtle}
                  style={{
                    color: t.fgStrong,
                    flex: 1,
                    fontSize: 16,
                    fontWeight: "700",
                    padding: 0,
                  }}
                  value={manualInput}
                />
                <Text
                  style={{
                    color: t.fgMuted,
                    fontSize: 14,
                    fontWeight: "700",
                  }}
                >
                  원
                </Text>
              </View>
              <Pressable
                disabled={!canSubmitManual}
                onPress={submitManual}
                style={{
                  alignItems: "center",
                  backgroundColor: canSubmitManual ? t.primary : t.borderStrong,
                  borderRadius: 10,
                  height: 48,
                  justifyContent: "center",
                  paddingHorizontal: 18,
                }}
              >
                {createMut.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text
                    style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}
                  >
                    추가
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={() => setManualOpen(true)}
            style={{
              alignItems: "center",
              flexDirection: "row",
              gap: 10,
              paddingVertical: 8,
            }}
          >
            <View
              style={{
                alignItems: "center",
                backgroundColor: t.bgSubtle,
                borderRadius: 999,
                height: 32,
                justifyContent: "center",
                width: 32,
              }}
            >
              <Icon.plus color={t.fgMuted} size={16} />
            </View>
            <Text
              style={{ color: t.fgStrong, fontSize: 16, fontWeight: "700" }}
            >
              가격 직접 입력
            </Text>
          </Pressable>
        )}
      </View>
    </>
  );
}
