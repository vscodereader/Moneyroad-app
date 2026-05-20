import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MrScreen } from "@/features/moneyroad/components";
import { stocks } from "@/features/moneyroad/data";
import { Icon, SIGNAL_TYPE_ICON } from "@/features/moneyroad/icons";
import { nav } from "@/features/moneyroad/nav";
import {
  SIGNAL_TYPE_KEYS,
  type SignalTypeKey,
  signalMeta,
  useMrTheme,
} from "@/features/moneyroad/theme";

const SIGNAL_DESC: Record<SignalTypeKey, string> = {
  tech: "이평선·RSI·거래량 등 지표 변화",
  ai: "내부 학습 모델의 매수·매도 신호",
  event: "공시·실적·정책 등 이벤트",
  community: "토론·언급량의 급격한 변화",
};

const STEP_KEYS = ["intro", "watchlist", "signals", "ready"] as const;
const TOTAL_STEPS = STEP_KEYS.length;

function toggle(set: Set<string>, key: string): Set<string> {
  const next = new Set(set);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  return next;
}

export default function OnboardingScreen() {
  const { t } = useMrTheme();
  const insets = useSafeAreaInsets();
  const meta = signalMeta(t);
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<Set<string>>(
    new Set(["005930", "000660", "373220"])
  );
  const [sigTypes, setSigTypes] = useState<Set<string>>(
    new Set(["tech", "event", "ai"])
  );

  const nextDisabled = step === 1 && picked.size < 3;
  const isLast = step === TOTAL_STEPS - 1;

  return (
    <MrScreen>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 8 }}
        showsVerticalScrollIndicator={false}
      >
        {step === 0 ? (
          <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 32 }}>
            <View style={{ marginTop: 40, alignItems: "center", gap: 28 }}>
              <View
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: 24,
                  backgroundColor: t.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  shadowColor: t.primary,
                  shadowOffset: { width: 0, height: 12 },
                  shadowOpacity: 0.5,
                  shadowRadius: 16,
                  elevation: 8,
                }}
              >
                <Icon.logo color="#fff" size={48} />
              </View>
              <View style={{ alignItems: "center" }}>
                <Text
                  style={{
                    fontSize: 28,
                    fontWeight: "800",
                    letterSpacing: -0.5,
                    color: t.fgStrong,
                  }}
                >
                  머니로드
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: t.fgMuted,
                    fontWeight: "600",
                    marginTop: 6,
                  }}
                >
                  MoneyRoad · 한국 개인투자자를 위한
                </Text>
              </View>
            </View>
            <Text
              style={{
                marginTop: 36,
                fontSize: 22,
                lineHeight: 33,
                fontWeight: "800",
                color: t.fgStrong,
                letterSpacing: -0.3,
                textAlign: "center",
              }}
            >
              관심 종목의 시그널 · 뉴스 · 토론을{"\n"}한 화면에서 확인하세요
            </Text>
            <Text
              style={{
                marginTop: 16,
                textAlign: "center",
                color: t.fgMuted,
                fontSize: 14,
                lineHeight: 22,
              }}
            >
              머니로드는 매매를 권유하거나 대신 거래하지 않습니다.{"\n"}투자자의
              의사결정에 필요한 정보를 정리해 보여줍니다.
            </Text>
          </View>
        ) : null}

        {step === 1 ? (
          <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 8 }}>
            <Text
              style={{
                fontSize: 22,
                fontWeight: "800",
                letterSpacing: -0.3,
                marginTop: 16,
                color: t.fgStrong,
              }}
            >
              관심 종목을 골라보세요
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: t.fgMuted,
                marginTop: 6,
                marginBottom: 16,
              }}
            >
              최소 3개를 선택하면 시그널을 더 정확하게 학습합니다.
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {stocks.map((s) => {
                const on = picked.has(s.code);
                return (
                  <Pressable
                    key={s.code}
                    onPress={() => setPicked(toggle(picked, s.code))}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      borderRadius: 999,
                      borderWidth: on ? 1.5 : 1,
                      borderColor: on ? t.primary : t.borderStrong,
                      backgroundColor: on ? t.primarySubtle : t.bg,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {on ? (
                      <View style={{ transform: [{ rotate: "45deg" }] }}>
                        <Icon.plus color={t.primary} size={14} />
                      </View>
                    ) : null}
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "700",
                        color: on ? t.primary : t.fgStrong,
                      }}
                    >
                      {s.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={{ marginTop: 18, fontSize: 13, color: t.fgMuted }}>
              선택 {picked.size}개
            </Text>
          </View>
        ) : null}

        {step === 2 ? (
          <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 8 }}>
            <Text
              style={{
                fontSize: 22,
                fontWeight: "800",
                letterSpacing: -0.3,
                marginTop: 16,
                color: t.fgStrong,
              }}
            >
              어떤 시그널을 받을까요?
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: t.fgMuted,
                marginTop: 6,
                marginBottom: 20,
              }}
            >
              4가지 시그널을 종합해 0~100점 점수로 보여드립니다. 받고 싶은
              종류를 골라주세요.
            </Text>
            {SIGNAL_TYPE_KEYS.map((k) => {
              const m = meta[k];
              const TypeIcon = SIGNAL_TYPE_ICON[k];
              const on = sigTypes.has(k);
              return (
                <Pressable
                  key={k}
                  onPress={() => setSigTypes(toggle(sigTypes, k))}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                    padding: 14,
                    marginBottom: 10,
                    borderRadius: 12,
                    borderWidth: on ? 1.5 : 1,
                    borderColor: on ? m.color : t.border,
                    backgroundColor: on ? m.bg : t.bg,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      backgroundColor: m.bg,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <TypeIcon color={m.color} size={22} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "700",
                        color: t.fgStrong,
                      }}
                    >
                      {m.label}
                    </Text>
                    <Text
                      style={{ fontSize: 12, color: t.fgMuted, marginTop: 2 }}
                    >
                      {SIGNAL_DESC[k]}
                    </Text>
                  </View>
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      borderWidth: on ? 0 : 1.5,
                      borderColor: t.borderStrong,
                      backgroundColor: on ? m.color : "transparent",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {on ? <Icon.check color="#fff" size={14} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {step === 3 ? (
          <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 8 }}>
            <View style={{ marginTop: 20, alignItems: "center" }}>
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 999,
                  backgroundColor: t.successBg,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon.check color={t.success} size={44} />
              </View>
            </View>
            <Text
              style={{
                fontSize: 22,
                fontWeight: "800",
                letterSpacing: -0.3,
                marginTop: 20,
                color: t.fgStrong,
                textAlign: "center",
              }}
            >
              준비가 완료되었습니다
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: t.fgMuted,
                marginTop: 6,
                marginBottom: 24,
                textAlign: "center",
              }}
            >
              관심 종목 {picked.size}개 · 시그널 {sigTypes.size}종
            </Text>
            <View
              style={{
                backgroundColor: t.bgSubtle,
                borderWidth: 1,
                borderColor: t.border,
                borderRadius: 12,
                padding: 14,
              }}
            >
              <Text
                style={{
                  fontWeight: "800",
                  color: t.fgStrong,
                  marginBottom: 4,
                  fontSize: 12,
                }}
              >
                투자 유의 안내
              </Text>
              <Text style={{ fontSize: 12, color: t.fgMuted, lineHeight: 20 }}>
                머니로드가 제공하는 시그널·점수·뉴스 요약은 투자자의 판단을
                보조하기 위한 정보이며 매매를 권유하는 것이 아닙니다. 모든
                투자의 책임은 투자자 본인에게 있습니다.
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View
        style={{
          paddingHorizontal: 24,
          paddingTop: 12,
          paddingBottom: insets.bottom + 16,
          backgroundColor: t.bg,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            gap: 6,
            justifyContent: "center",
            paddingVertical: 16,
          }}
        >
          {STEP_KEYS.map((key, i) => (
            <View
              key={key}
              style={{
                width: i === step ? 22 : 6,
                height: 6,
                borderRadius: 999,
                backgroundColor: i === step ? t.primary : t.borderStrong,
              }}
            />
          ))}
        </View>
        <Pressable
          disabled={nextDisabled}
          onPress={() => (isLast ? nav.finishOnboarding() : setStep(step + 1))}
          style={{
            height: 52,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: nextDisabled ? t.bgMuted : t.primary,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "800",
              color: nextDisabled ? t.fgSubtle : "#fff",
            }}
          >
            {isLast ? "시작하기" : "다음"}
          </Text>
        </Pressable>
        {step > 0 && !isLast ? (
          <Pressable
            onPress={() => setStep(step - 1)}
            style={{
              height: 40,
              marginTop: 6,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: t.fgMuted, fontSize: 14, fontWeight: "600" }}>
              이전
            </Text>
          </Pressable>
        ) : null}
        {step === 0 ? (
          <Pressable
            onPress={() => nav.finishOnboarding()}
            style={{
              height: 40,
              marginTop: 6,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: t.fgMuted, fontSize: 14, fontWeight: "600" }}>
              건너뛰기
            </Text>
          </Pressable>
        ) : null}
      </View>
    </MrScreen>
  );
}
