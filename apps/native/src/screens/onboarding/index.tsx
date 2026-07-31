import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, SIGNAL_TYPE_ICON } from "@/components/icons";
import { MrScreen, StockResourceLogo } from "@/components/ui";
import { useMrTheme } from "@/hooks/use-mr-theme";
import { nav } from "@/utils/nav";
import { orpc } from "@/utils/orpc";
import {
  SIGNAL_TYPE_KEYS,
  type SignalTypeKey,
  signalMeta,
} from "@/utils/theme";

const SIGNAL_DESC: Record<SignalTypeKey, string> = {
  tech: "이평선·RSI·거래량 등 지표 변화",
  ai: "내부 학습 모델의 매수·매도 신호",
  event: "공시·실적·정책 등 이벤트",
  community: "토론·언급량의 급격한 변화",
};

const STEP_KEYS = ["intro", "watchlist", "signals", "ready"] as const;
const TOTAL_STEPS = STEP_KEYS.length;

interface StockEntry {
  code: string;
  iconUrl?: null | string;
  market: string;
  name: string;
}

function toggle(set: Set<string>, key: string): Set<string> {
  const next = new Set(set);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  return next;
}

function OnboardingFooter({
  bottomInset,
  error,
  isLast,
  isPending,
  nextDisabled,
  onBack,
  onNext,
  onSkip,
  step,
  t,
}: {
  bottomInset: number;
  error: string | null;
  isLast: boolean;
  isPending: boolean;
  nextDisabled: boolean;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
  step: number;
  t: ReturnType<typeof useMrTheme>["t"];
}) {
  return (
    <View
      style={{
        paddingHorizontal: 24,
        paddingTop: 12,
        paddingBottom: bottomInset + 16,
        backgroundColor: t.bg,
      }}
    >
      {error ? (
        <Text
          style={{
            color: t.downStrong,
            fontSize: 13,
            marginBottom: 4,
            textAlign: "center",
          }}
        >
          {error}
        </Text>
      ) : null}
      <View
        style={{
          flexDirection: "row",
          gap: 6,
          justifyContent: "center",
          paddingVertical: 16,
        }}
      >
        {STEP_KEYS.map((key, index) => (
          <View
            key={key}
            style={{
              width: index === step ? 22 : 6,
              height: 6,
              borderRadius: 999,
              backgroundColor: index === step ? t.primary : t.borderStrong,
            }}
          />
        ))}
      </View>
      <Pressable
        disabled={nextDisabled || isPending}
        onPress={onNext}
        style={{
          height: 52,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: nextDisabled ? t.bgMuted : t.primary,
        }}
      >
        {isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text
            style={{
              fontSize: 16,
              fontWeight: "800",
              color: nextDisabled ? t.fgSubtle : "#fff",
            }}
          >
            {isLast ? "시작하기" : "다음"}
          </Text>
        )}
      </Pressable>
      {step > 0 && !isLast ? (
        <Pressable
          onPress={onBack}
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
          disabled={isPending}
          onPress={onSkip}
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
  );
}

export default function OnboardingScreen() {
  const { t } = useMrTheme();
  const insets = useSafeAreaInsets();
  const meta = signalMeta(t);
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<Map<string, StockEntry>>(new Map());
  const [sigTypes, setSigTypes] = useState<Set<string>>(new Set());
  const [searchInput, setSearchInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const searchText = searchInput.trim();
  const stockSearch = useQuery(
    orpc.stock.search.queryOptions({
      input: { query: searchText },
      enabled: searchText.length > 0,
    })
  );
  const complete = useMutation(
    orpc.onboarding.complete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.onboarding.status.key(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.watchlist.list.queryKey(),
        });
        nav.finishOnboarding();
      },
      onError: (mutationError) => {
        setError(
          mutationError.message ||
            "온보딩을 저장하지 못했어요. 잠시 후 다시 시도해 주세요."
        );
      },
    })
  );

  const nextDisabled = step === 1 && picked.size < 3;
  const isLast = step === TOTAL_STEPS - 1;

  const toggleStock = (entry: StockEntry) => {
    setPicked((current) => {
      const next = new Map(current);
      if (next.has(entry.code)) {
        next.delete(entry.code);
      } else {
        next.set(entry.code, entry);
      }
      return next;
    });
  };

  const finish = (stockCodes: string[]) => {
    if (complete.isPending) {
      return;
    }
    setError(null);
    complete.mutate({ stockCodes });
  };

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
            {picked.size > 0 ? (
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 14,
                }}
              >
                {[...picked.values()].map((stock) => (
                  <Pressable
                    key={stock.code}
                    onPress={() => toggleStock(stock)}
                    style={{
                      alignItems: "center",
                      backgroundColor: t.primarySubtle,
                      borderColor: t.primary,
                      borderRadius: 999,
                      borderWidth: 1,
                      flexDirection: "row",
                      gap: 6,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                    }}
                  >
                    <Text
                      style={{
                        color: t.primary,
                        fontSize: 13,
                        fontWeight: "700",
                      }}
                    >
                      {stock.name}
                    </Text>
                    <Icon.close color={t.primary} size={14} />
                  </Pressable>
                ))}
              </View>
            ) : null}
            <View
              style={{
                alignItems: "center",
                backgroundColor: t.bgSubtle,
                borderRadius: 10,
                flexDirection: "row",
                gap: 8,
                height: 44,
                paddingHorizontal: 12,
              }}
            >
              <Icon.search color={t.fgSubtle} size={18} />
              <TextInput
                autoCapitalize="none"
                onChangeText={setSearchInput}
                placeholder="종목명 또는 코드 검색"
                placeholderTextColor={t.fgSubtle}
                style={{ color: t.fgStrong, flex: 1, fontSize: 15 }}
                value={searchInput}
              />
              {searchInput ? (
                <Pressable hitSlop={8} onPress={() => setSearchInput("")}>
                  <Icon.close color={t.fgSubtle} size={16} />
                </Pressable>
              ) : null}
            </View>
            <Text style={{ marginTop: 18, fontSize: 13, color: t.fgMuted }}>
              선택 {picked.size}개
            </Text>
            {stockSearch.isLoading ? (
              <ActivityIndicator color={t.primary} style={{ marginTop: 28 }} />
            ) : null}
            {searchText && stockSearch.data?.length === 0 ? (
              <Text
                style={{
                  color: t.fgSubtle,
                  fontSize: 13,
                  marginTop: 28,
                  textAlign: "center",
                }}
              >
                검색 결과가 없어요.
              </Text>
            ) : null}
            {stockSearch.data?.map((stock) => {
              const selected = picked.has(stock.code);
              return (
                <Pressable
                  key={stock.code}
                  onPress={() => toggleStock(stock)}
                  style={{
                    alignItems: "center",
                    borderBottomColor: t.border,
                    borderBottomWidth: 1,
                    flexDirection: "row",
                    gap: 12,
                    paddingVertical: 12,
                  }}
                >
                  <StockResourceLogo
                    iconUrl={stock.iconUrl}
                    name={stock.name}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: t.fgStrong,
                        fontSize: 15,
                        fontWeight: "700",
                      }}
                    >
                      {stock.name}
                    </Text>
                    <Text
                      style={{
                        color: t.fgSubtle,
                        fontSize: 11,
                        marginTop: 3,
                      }}
                    >
                      {stock.code} · {stock.market}
                    </Text>
                  </View>
                  <View
                    style={{
                      alignItems: "center",
                      backgroundColor: selected ? t.primary : t.bgSubtle,
                      borderRadius: 999,
                      height: 32,
                      justifyContent: "center",
                      width: 32,
                    }}
                  >
                    {selected ? (
                      <Icon.check color={t.primaryOn} size={18} />
                    ) : (
                      <Icon.plus color={t.fgStrong} size={18} />
                    )}
                  </View>
                </Pressable>
              );
            })}
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

      <OnboardingFooter
        bottomInset={insets.bottom}
        error={error}
        isLast={isLast}
        isPending={complete.isPending}
        nextDisabled={nextDisabled}
        onBack={() => setStep(step - 1)}
        onNext={() => (isLast ? finish([...picked.keys()]) : setStep(step + 1))}
        onSkip={() => {
          setSigTypes(new Set());
          finish([]);
        }}
        step={step}
        t={t}
      />
    </MrScreen>
  );
}
