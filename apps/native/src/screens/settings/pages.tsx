// MoneyRoad — MyPage settings sub-screens (8)

import { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";

import { Gradient } from "@/components/charts";
import { Icon } from "@/components/icons";
import { SegmentedControl, StockLogo, Switch } from "@/components/ui";
import { useMrTheme } from "@/hooks/use-mr-theme";
import { useNotificationSettings } from "@/hooks/use-notification-settings";
import InquiryFormScreen from "@/screens/settings/inquiry";
import { PrivacyPolicy, TermsOfService } from "@/screens/settings/legal";
import {
  SettingsGroup,
  SettingsRow,
  SettingsScreen,
  Slider,
} from "@/screens/settings/ui";
import { findStock } from "@/utils/data";
import { fmt } from "@/utils/format";
import { nav } from "@/utils/nav";
import {
  SIGNAL_TYPE_KEYS,
  type SignalTypeKey,
  signalMeta,
} from "@/utils/theme";

// ── 1. 시그널 알림 설정 ───────────────────────────────────────
// 매수/매도/관망 3유형으로 단순화. 이전(tech/ai/event/community 유형 + 강도 임계값
// + 방해 금지) 구현은 pages.tsx.temp 참고 (향후 작업).
const SIGNAL_ALERT_TYPES = [
  {
    k: "buySignal",
    label: "매수 시그널",
    sub: "매수 추천 신호가 발생하면 알림",
    dot: "up",
  },
  {
    k: "sellSignal",
    label: "매도 시그널",
    sub: "매도 추천 신호가 발생하면 알림",
    dot: "down",
  },
  {
    k: "holdSignal",
    label: "관망 시그널",
    sub: "관망(중립) 신호가 발생하면 알림",
    dot: "muted",
  },
] as const;

export function SignalAlertSettings() {
  const { t } = useMrTheme();
  const { get, toggle } = useNotificationSettings();
  const dotColor: Record<string, string> = {
    up: t.upStrong,
    down: t.downStrong,
    muted: t.fgMuted,
  };

  return (
    <SettingsScreen title="시그널 알림 설정">
      <SettingsGroup
        label="알림 받을 시그널 유형"
        sublabel="선택한 유형의 시그널이 발생하면 푸시 알림을 받습니다."
      >
        {SIGNAL_ALERT_TYPES.map((it) => (
          <SettingsRow
            key={it.k}
            label={
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    backgroundColor: dotColor[it.dot],
                  }}
                />
                <Text
                  style={{ fontSize: 14, fontWeight: "600", color: t.fgStrong }}
                >
                  {it.label}
                </Text>
              </View>
            }
            right={<Switch on={get(it.k)} onChange={(v) => toggle(it.k, v)} />}
            sub={it.sub}
          />
        ))}
      </SettingsGroup>
      <View style={{ height: 16 }} />
    </SettingsScreen>
  );
}

// ── 2. 뉴스·공시 알림 설정 ────────────────────────────────────
// 관심 종목 알림만으로 단순화. 이전(카테고리/출처/AI요약) 구현은 pages.tsx.temp 참고.
export function NewsAlertSettings() {
  const { get, toggle } = useNotificationSettings();
  const on = get("breakingNews");

  return (
    <SettingsScreen title="뉴스·공시 알림 설정">
      <SettingsGroup
        label="관심 종목 알림"
        sublabel="관심 종목으로 등록한 종목의 뉴스·공시가 올라오면 알림을 받습니다."
      >
        <SettingsRow
          label="관심 종목 뉴스·공시 알림"
          right={<Switch on={on} onChange={(v) => toggle("breakingNews", v)} />}
          sub={on ? "관심 종목에 한해 알림" : "꺼짐"}
        />
      </SettingsGroup>
      <View style={{ height: 16 }} />
    </SettingsScreen>
  );
}

// ── 3. 가격 알림 ──────────────────────────────────────────────
interface PriceAlert {
  active: boolean;
  code: string;
  hit: boolean;
  hitTime?: string;
  id: string;
  type: "above" | "below";
  value: number;
}

export function PriceAlerts() {
  const { t } = useMrTheme();
  const [alerts, setAlerts] = useState<PriceAlert[]>([
    {
      id: "a1",
      code: "005930",
      type: "above",
      value: 80_000,
      active: true,
      hit: false,
    },
    {
      id: "a2",
      code: "000660",
      type: "below",
      value: 200_000,
      active: true,
      hit: false,
    },
    {
      id: "a3",
      code: "035420",
      type: "below",
      value: 185_000,
      active: false,
      hit: true,
      hitTime: "오늘 14:20",
    },
    {
      id: "a4",
      code: "373220",
      type: "above",
      value: 380_000,
      active: true,
      hit: false,
    },
  ]);
  const toggle = (id: string, v: boolean) =>
    setAlerts(alerts.map((a) => (a.id === id ? { ...a, active: v } : a)));
  const activeCount = alerts.filter((a) => a.active).length;

  return (
    <SettingsScreen
      right={
        <Pressable
          hitSlop={6}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 2,
            paddingHorizontal: 8,
          }}
        >
          <Icon.plus color={t.primary} size={16} />
          <Text style={{ fontSize: 13, fontWeight: "700", color: t.primary }}>
            추가
          </Text>
        </Pressable>
      }
      title="가격 알림"
    >
      <SettingsGroup
        label="활성 알림"
        sublabel={`${activeCount}개의 알림이 활성화되어 있습니다.`}
      >
        {alerts.map((a) => {
          const stock = findStock(a.code);
          if (!stock) {
            return null;
          }
          const diff = ((a.value - stock.price) / stock.price) * 100;
          return (
            <View
              key={a.id}
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
              <StockLogo radius={8} size={36} stock={stock} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "700",
                      color: t.fgStrong,
                    }}
                  >
                    {stock.name}
                  </Text>
                  {a.hit ? (
                    <View
                      style={{
                        paddingHorizontal: 6,
                        paddingVertical: 1,
                        borderRadius: 4,
                        backgroundColor: t.successBg,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "800",
                          color: t.success,
                        }}
                      >
                        도달
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={{ fontSize: 12, color: t.fgMuted, marginTop: 3 }}>
                  <Text
                    style={{
                      fontWeight: "700",
                      color: a.type === "above" ? t.upStrong : t.downStrong,
                    }}
                  >
                    {a.type === "above" ? "↑ 도달가" : "↓ 도달가"}
                  </Text>
                  <Text style={{ fontWeight: "700", color: t.fgStrong }}>
                    {" "}
                    {fmt.price(a.value)}원
                  </Text>
                  <Text style={{ color: t.fgSubtle }}>
                    {"  "}(현재가 대비 {diff > 0 ? "+" : ""}
                    {diff.toFixed(1)}%)
                  </Text>
                </Text>
                {a.hit ? (
                  <Text
                    style={{ fontSize: 11, color: t.fgSubtle, marginTop: 2 }}
                  >
                    {a.hitTime} 도달
                  </Text>
                ) : null}
              </View>
              <Switch on={a.active} onChange={(v) => toggle(a.id, v)} />
            </View>
          );
        })}
      </SettingsGroup>

      <View style={{ padding: 16, marginTop: 8 }}>
        <View
          style={{ padding: 14, borderRadius: 12, backgroundColor: t.bgSubtle }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: "800",
              color: t.fgStrong,
              marginBottom: 4,
            }}
          >
            가격 알림은 어떻게 작동하나요?
          </Text>
          <Text style={{ fontSize: 12, lineHeight: 19, color: t.fgMuted }}>
            설정한 도달가에 주가가 처음 닿을 때 1회 푸시 알림이 옵니다. 도달
            후에는 자동으로 비활성화되며, 다시 활성화하려면 토글을 켜세요. 장
            운영 시간 외에는 알림이 지연될 수 있습니다.
          </Text>
        </View>
      </View>
      <View style={{ height: 16 }} />
    </SettingsScreen>
  );
}

// ── 4. AI 시그널 학습 데이터 ──────────────────────────────────
export function AiSettings() {
  const { t } = useMrTheme();
  const meta = signalMeta(t);
  const [confidence, setConfidence] = useState(70);
  const [usePersonal, setUsePersonal] = useState(true);
  const weights: Record<SignalTypeKey, number> = {
    tech: 30,
    ai: 30,
    event: 20,
    community: 20,
  };
  const total = weights.tech + weights.ai + weights.event + weights.community;

  return (
    <SettingsScreen title="AI 시그널 학습 데이터">
      <SettingsGroup
        label="개인화 학습"
        sublabel="사용자의 관심 종목, 매매 의사 표현을 학습에 반영합니다."
      >
        <SettingsRow
          label="개인화 학습 사용"
          right={<Switch on={usePersonal} onChange={setUsePersonal} />}
          sub="끄면 모든 사용자에게 동일한 모델 적용"
        />
        <SettingsRow
          label="학습 데이터 초기화"
          right={<Icon.chevRight color={t.fgSubtle} size={16} />}
          sub="지금까지 학습된 개인 데이터를 삭제"
        />
      </SettingsGroup>

      <SettingsGroup
        label="모델 신뢰도 임계값"
        sublabel="신뢰도가 임계값 미만이면 시그널을 표시하지 않습니다."
      >
        <View
          style={{
            padding: 16,
            backgroundColor: t.bg,
            borderBottomWidth: 1,
            borderBottomColor: t.border,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 12,
            }}
          >
            <Text
              style={{ fontSize: 14, fontWeight: "600", color: t.fgStrong }}
            >
              현재 임계값
            </Text>
            <View style={{ flexDirection: "row", alignItems: "baseline" }}>
              <Text
                style={{ fontSize: 22, fontWeight: "800", color: t.primary }}
              >
                {confidence}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: t.fgMuted,
                  marginLeft: 2,
                }}
              >
                %
              </Text>
            </View>
          </View>
          <Slider
            max={95}
            min={50}
            onChange={setConfidence}
            value={confidence}
          />
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: 4,
            }}
          >
            <Text style={{ fontSize: 10, color: t.fgSubtle }}>
              많은 시그널 (50%)
            </Text>
            <Text style={{ fontSize: 10, color: t.fgSubtle }}>
              정밀한 시그널 (95%)
            </Text>
          </View>
        </View>
      </SettingsGroup>

      <SettingsGroup
        label="시그널 가중치"
        sublabel="종합 점수 계산 시 각 시그널의 비중을 조정합니다."
      >
        {SIGNAL_TYPE_KEYS.map((k) => (
          <View
            key={k}
            style={{
              paddingVertical: 14,
              paddingHorizontal: 16,
              backgroundColor: t.bg,
              borderBottomWidth: 1,
              borderBottomColor: t.border,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    backgroundColor: meta[k].color,
                  }}
                />
                <Text
                  style={{ fontSize: 14, fontWeight: "600", color: t.fgStrong }}
                >
                  {meta[k].label}
                </Text>
              </View>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "800",
                  color: meta[k].color,
                }}
              >
                {weights[k]}%
              </Text>
            </View>
            <View
              style={{
                height: 6,
                backgroundColor: t.bgMuted,
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: `${weights[k]}%`,
                  height: 6,
                  backgroundColor: meta[k].color,
                }}
              />
            </View>
          </View>
        ))}
        <View style={{ paddingVertical: 10, paddingHorizontal: 16 }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: "700",
              color: total === 100 ? t.success : t.warning,
            }}
          >
            합계 {total}% {total === 100 ? "✓" : "(100%로 조정 필요)"}
          </Text>
        </View>
      </SettingsGroup>
      <View style={{ height: 16 }} />
    </SettingsScreen>
  );
}

// ── 5. 화면 표시 설정 ─────────────────────────────────────────
export function DisplaySettings() {
  const { t } = useMrTheme();
  const [colorConv, setColorConv] = useState<"kr" | "global">("kr");
  const [density, setDensity] = useState<"compact" | "regular" | "comfy">(
    "regular"
  );
  const [showSpark, setShowSpark] = useState(true);
  const [textSize, setTextSize] = useState<"small" | "regular" | "large">(
    "regular"
  );

  return (
    <SettingsScreen title="화면 표시 설정">
      <SettingsGroup label="등락 색상">
        <SettingsRow
          label="색상 컨벤션"
          right={
            <SegmentedControl
              onChange={setColorConv}
              options={[
                { value: "kr", label: "한국" },
                { value: "global", label: "글로벌" },
              ]}
              value={colorConv}
            />
          }
          sub={
            colorConv === "kr"
              ? "한국식 — 상승 빨강, 하락 파랑"
              : "글로벌식 — 상승 초록, 하락 빨강"
          }
        />
      </SettingsGroup>

      <SettingsGroup label="정보 밀도">
        <SettingsRow
          label="목록 밀도"
          right={
            <SegmentedControl
              onChange={setDensity}
              options={[
                { value: "compact", label: "조밀" },
                { value: "regular", label: "보통" },
                { value: "comfy", label: "여유" },
              ]}
              value={density}
            />
          }
          sub="한 화면에 표시되는 항목 수에 영향"
        />
        <SettingsRow
          label="목록에 스파크라인 표시"
          right={<Switch on={showSpark} onChange={setShowSpark} />}
          sub="관심 종목 목록의 미니 차트"
        />
      </SettingsGroup>

      <SettingsGroup label="글자 크기">
        <SettingsRow
          label="크기"
          right={
            <SegmentedControl
              onChange={setTextSize}
              options={[
                { value: "small", label: "작게" },
                { value: "regular", label: "보통" },
                { value: "large", label: "크게" },
              ]}
              value={textSize}
            />
          }
          sub={{ small: "작게", regular: "보통", large: "크게" }[textSize]}
        />
      </SettingsGroup>

      <SettingsGroup label="시작 화면">
        <SettingsRow
          label="앱 실행 시 보이는 탭"
          right={<Icon.chevRight color={t.fgSubtle} size={16} />}
          sub="홈"
        />
      </SettingsGroup>
      <View style={{ height: 16 }} />
    </SettingsScreen>
  );
}

// ── 6. 내가 쓴 글·답글 ────────────────────────────────────────
export function MyPosts() {
  const { t } = useMrTheme();
  const [tab, setTab] = useState<"posts" | "replies">("posts");
  const myPosts = [
    {
      id: "t1",
      title: "하이닉스 22만원 돌파, 25만원까지 보시는 분?",
      time: "5분 전",
      replies: 38,
      likes: 124,
      code: "000660",
    },
    {
      id: "mp1",
      title: "삼성전자 단기 80,000원 저항 돌파 어떻게 보시나요",
      time: "어제",
      replies: 12,
      likes: 27,
      code: "005930",
    },
  ];
  const myReplies = [
    {
      id: "r1",
      threadId: "t2",
      threadTitle: "체코 원전 본계약! 드디어 결실",
      text: "축하드립니다. 추가 수주 모멘텀 이어지길.",
      time: "20분 전",
      code: "034020",
    },
    {
      id: "r2",
      threadId: "t3",
      threadTitle: "카카오 규제 이슈, 어디까지 빠질까요",
      text: "발표 전까지 비중 줄여놓는게 안전할 듯합니다.",
      time: "1시간 전",
      code: "035720",
    },
    {
      id: "r3",
      threadId: "t5",
      threadTitle: "LG엔솔 IRA 추가 보조금 확정",
      text: "GM 합작공장 가동률 회복 데이터 어디서 확인할 수 있나요?",
      time: "3시간 전",
      code: "373220",
    },
  ];

  const tabChip = (key: "posts" | "replies", label: string) => {
    const active = tab === key;
    return (
      <Pressable
        key={key}
        onPress={() => setTab(key)}
        style={{
          height: 32,
          paddingHorizontal: 12,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: active ? t.fgStrong : t.borderStrong,
          backgroundColor: active ? t.fgStrong : t.bg,
          justifyContent: "center",
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
      </Pressable>
    );
  };

  return (
    <SettingsScreen title="내가 쓴 글·답글">
      <View
        style={{
          flexDirection: "row",
          gap: 6,
          paddingHorizontal: 16,
          paddingVertical: 10,
        }}
      >
        {tabChip("posts", `내 글 ${myPosts.length}`)}
        {tabChip("replies", `답글 ${myReplies.length}`)}
      </View>

      {tab === "posts"
        ? myPosts.map((p) => {
            const stock = findStock(p.code);
            return (
              <Pressable
                key={p.id}
                onPress={() => nav.openDiscussionRoom(p.id)}
                style={{
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  backgroundColor: t.bg,
                  borderBottomWidth: 1,
                  borderBottomColor: t.border,
                }}
              >
                <View
                  style={{ flexDirection: "row", gap: 6, alignItems: "center" }}
                >
                  {stock ? (
                    <View
                      style={{
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        backgroundColor: t.bgSubtle,
                        borderRadius: 4,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "700",
                          color: t.fgMuted,
                        }}
                      >
                        {stock.name}
                      </Text>
                    </View>
                  ) : null}
                  <Text style={{ fontSize: 11, color: t.fgSubtle }}>
                    {p.time}
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: t.fgStrong,
                    marginTop: 6,
                    lineHeight: 20,
                  }}
                >
                  {p.title}
                </Text>
                <View style={{ flexDirection: "row", gap: 14, marginTop: 8 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 3,
                    }}
                  >
                    <Icon.thumbsUp color={t.fgMuted} size={13} />
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: t.fgMuted,
                      }}
                    >
                      {p.likes}
                    </Text>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 3,
                    }}
                  >
                    <Icon.reply color={t.fgMuted} size={13} />
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: t.fgMuted,
                      }}
                    >
                      {p.replies}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })
        : myReplies.map((r) => {
            const stock = findStock(r.code);
            return (
              <Pressable
                key={r.id}
                onPress={() => nav.openDiscussionRoom(r.threadId)}
                style={{
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  backgroundColor: t.bg,
                  borderBottomWidth: 1,
                  borderBottomColor: t.border,
                }}
              >
                <View
                  style={{ flexDirection: "row", gap: 6, alignItems: "center" }}
                >
                  {stock ? (
                    <View
                      style={{
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        backgroundColor: t.bgSubtle,
                        borderRadius: 4,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "700",
                          color: t.fgMuted,
                        }}
                      >
                        {stock.name}
                      </Text>
                    </View>
                  ) : null}
                  <Text style={{ fontSize: 11, color: t.fgSubtle }}>
                    {r.time}
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: t.fgMuted,
                    marginTop: 6,
                    lineHeight: 18,
                  }}
                >
                  ↳ {r.threadTitle}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: t.fgStrong,
                    marginTop: 4,
                    lineHeight: 20,
                  }}
                >
                  {r.text}
                </Text>
              </Pressable>
            );
          })}
      <View style={{ height: 16 }} />
    </SettingsScreen>
  );
}

// ── 7. 공유 및 친구 초대 ──────────────────────────────────────
export function Invite() {
  const { t } = useMrTheme();
  const code = "MR-K1NV8T";
  const [copied, setCopied] = useState(false);
  const copy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  const shareTargets = [
    { l: "카카오톡", bg: "#FEE500", c: "#191919" },
    { l: "문자", bg: t.success, c: "#fff" },
    { l: "링크 복사", bg: t.bgMuted, c: t.fgStrong },
    { l: "더보기", bg: t.bgMuted, c: t.fgStrong },
  ];

  return (
    <SettingsScreen title="공유 및 친구 초대">
      <View style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 }}>
        <View
          style={{
            borderRadius: 16,
            shadowColor: t.primary,
            shadowOffset: { width: 0, height: 16 },
            shadowOpacity: 0.4,
            shadowRadius: 20,
            elevation: 8,
          }}
        >
          <Gradient
            borderRadius={16}
            colors={[t.primary, t.sigAi]}
            style={{ padding: 22 }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                color: "rgba(255,255,255,0.85)",
                letterSpacing: 0.3,
              }}
            >
              친구 초대 보상
            </Text>
            <Text
              style={{
                fontSize: 22,
                fontWeight: "800",
                color: "#fff",
                marginTop: 4,
                letterSpacing: -0.3,
                lineHeight: 29,
              }}
            >
              친구 1명 초대마다{"\n"}프리미엄 14일 무료
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.85)",
                marginTop: 8,
                lineHeight: 18,
              }}
            >
              친구가 회원가입 후 첫 관심 종목을 추가하면 양쪽 모두에게 14일이
              적립됩니다.
            </Text>
          </Gradient>
        </View>
      </View>

      <SettingsGroup label="내 초대 코드">
        <View style={{ paddingHorizontal: 16 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingVertical: 14,
              paddingHorizontal: 16,
              borderRadius: 12,
              backgroundColor: t.bgSubtle,
              borderWidth: 1,
              borderColor: t.border,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{ fontSize: 11, color: t.fgMuted, fontWeight: "600" }}
              >
                초대 코드
              </Text>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "800",
                  color: t.fgStrong,
                  letterSpacing: 1,
                }}
              >
                {code}
              </Text>
            </View>
            <Pressable
              onPress={copy}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderRadius: 8,
                backgroundColor: t.primary,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>
                {copied ? "복사됨 ✓" : "복사"}
              </Text>
            </Pressable>
          </View>
        </View>
      </SettingsGroup>

      <SettingsGroup label="공유">
        <View
          style={{
            flexDirection: "row",
            paddingHorizontal: 16,
            paddingVertical: 8,
          }}
        >
          {shareTargets.map((s) => (
            <View
              key={s.l}
              style={{
                flex: 1,
                alignItems: "center",
                gap: 6,
                paddingVertical: 12,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  backgroundColor: s.bg,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon.share color={s.c} size={22} />
              </View>
              <Text
                style={{ fontSize: 11, fontWeight: "600", color: t.fgStrong }}
              >
                {s.l}
              </Text>
            </View>
          ))}
        </View>
      </SettingsGroup>

      <SettingsGroup label="내 초대 현황">
        <SettingsRow
          label="가입 완료한 친구"
          right={
            <Text
              style={{ fontSize: 14, fontWeight: "800", color: t.fgStrong }}
            >
              3명
            </Text>
          }
        />
        <SettingsRow
          label="적립된 무료 기간"
          right={
            <Text style={{ fontSize: 14, fontWeight: "800", color: t.primary }}>
              42일
            </Text>
          }
        />
        <SettingsRow
          label="초대 내역 보기"
          right={<Icon.chevRight color={t.fgSubtle} size={16} />}
        />
      </SettingsGroup>
      <View style={{ height: 16 }} />
    </SettingsScreen>
  );
}

// ── 8. 공지사항 및 고객 지원 ──────────────────────────────────
export function Support() {
  const { t } = useMrTheme();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const notices = [
    {
      id: "n1",
      tag: "공지",
      title: "5월 20일 시스템 점검 안내 (01:00~03:00)",
      time: "1일 전",
      pinned: true,
    },
    {
      id: "n2",
      tag: "업데이트",
      title: "v1.4.2 업데이트 — 토론방 채팅 기능 추가",
      time: "3일 전",
    },
    {
      id: "n3",
      tag: "공지",
      title: "AI 시그널 알고리즘 v3.0 적용 안내",
      time: "1주일 전",
    },
    {
      id: "n4",
      tag: "이벤트",
      title: "친구 초대 이벤트, 적립 기간 2배 (~5/31)",
      time: "2주일 전",
    },
  ];
  const faqs: { q: string; a?: string }[] = [
    {
      q: "시그널 점수는 어떻게 계산되나요?",
      a: "기술·AI·이벤트·커뮤니티 4가지 시그널을 가중 평균하여 0~100점으로 환산합니다. 가중치는 마이 > AI 시그널 학습 데이터에서 조정할 수 있습니다.",
    },
    { q: "가격 알림이 오지 않아요" },
    { q: "관심 종목은 몇 개까지 등록할 수 있나요?" },
    { q: "AI 데일리 브리프는 언제 업데이트되나요?" },
  ];

  const tagStyle = (tag: string): { bg: string; color: string } => {
    if (tag === "공지") {
      return { bg: t.primarySubtle, color: t.primary };
    }
    if (tag === "업데이트") {
      return { bg: t.successBg, color: t.success };
    }
    return { bg: t.warningBg, color: t.warning };
  };

  return (
    <SettingsScreen title="공지사항 및 고객 지원">
      <SettingsGroup label="공지사항">
        {notices.map((n) => {
          const ts = tagStyle(n.tag);
          return (
            <Pressable
              key={n.id}
              style={{
                paddingVertical: 14,
                paddingHorizontal: 16,
                backgroundColor: t.bg,
                borderBottomWidth: 1,
                borderBottomColor: t.border,
              }}
            >
              <View
                style={{ flexDirection: "row", gap: 6, alignItems: "center" }}
              >
                {n.pinned ? <Text style={{ fontSize: 10 }}>📌</Text> : null}
                <View
                  style={{
                    paddingHorizontal: 6,
                    paddingVertical: 1,
                    borderRadius: 4,
                    backgroundColor: ts.bg,
                  }}
                >
                  <Text
                    style={{ fontSize: 10, fontWeight: "800", color: ts.color }}
                  >
                    {n.tag}
                  </Text>
                </View>
                <Text
                  style={{
                    marginLeft: "auto",
                    fontSize: 11,
                    color: t.fgSubtle,
                  }}
                >
                  {n.time}
                </Text>
              </View>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: t.fgStrong,
                  marginTop: 6,
                  lineHeight: 20,
                }}
              >
                {n.title}
              </Text>
            </Pressable>
          );
        })}
      </SettingsGroup>

      <SettingsGroup label="자주 묻는 질문 (FAQ)">
        {faqs.map((f, i) => (
          <View
            key={f.q}
            style={{
              backgroundColor: t.bg,
              borderBottomWidth: 1,
              borderBottomColor: t.border,
            }}
          >
            <Pressable
              onPress={() => setOpenFaq(openFaq === i ? null : i)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingVertical: 14,
                paddingHorizontal: 16,
              }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  backgroundColor: t.primarySubtle,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{ fontSize: 12, fontWeight: "800", color: t.primary }}
                >
                  Q
                </Text>
              </View>
              <Text
                style={{
                  flex: 1,
                  fontSize: 14,
                  fontWeight: "600",
                  color: t.fgStrong,
                  lineHeight: 20,
                }}
              >
                {f.q}
              </Text>
              <View
                style={{
                  transform: [{ rotate: openFaq === i ? "180deg" : "0deg" }],
                }}
              >
                <Icon.chevDown color={t.fgSubtle} size={16} />
              </View>
            </Pressable>
            {openFaq === i && f.a ? (
              <Text
                style={{
                  paddingLeft: 48,
                  paddingRight: 16,
                  paddingBottom: 16,
                  fontSize: 13,
                  lineHeight: 21,
                  color: t.fgMuted,
                }}
              >
                {f.a}
              </Text>
            ) : null}
          </View>
        ))}
      </SettingsGroup>

      <SettingsGroup label="문의하기">
        <SettingsRow
          label="1:1 문의 접수"
          onPress={() => nav.openSettings("inquiry")}
          right={<Icon.chevRight color={t.fgSubtle} size={16} />}
          sub="평일 09:00~18:00 응답"
        />
        <SettingsRow
          label="이메일 문의"
          onPress={() => Linking.openURL("mailto:support@moneyroad.ai.kr")}
          right={<Icon.chevRight color={t.fgSubtle} size={16} />}
          sub="support@moneyroad.ai.kr"
        />
        <SettingsRow
          label="이용약관"
          onPress={() => nav.openSettings("terms")}
          right={<Icon.chevRight color={t.fgSubtle} size={16} />}
        />
        <SettingsRow
          label="개인정보 처리방침"
          onPress={() => nav.openSettings("privacy")}
          right={<Icon.chevRight color={t.fgSubtle} size={16} />}
        />
      </SettingsGroup>
      <View style={{ height: 16 }} />
    </SettingsScreen>
  );
}

export const SETTINGS_PAGES: Record<string, () => React.JSX.Element> = {
  "signal-alert": SignalAlertSettings,
  "news-alert": NewsAlertSettings,
  "price-alert": PriceAlerts,
  ai: AiSettings,
  display: DisplaySettings,
  posts: MyPosts,
  invite: Invite,
  support: Support,
  inquiry: InquiryFormScreen,
  terms: TermsOfService,
  privacy: PrivacyPolicy,
};
