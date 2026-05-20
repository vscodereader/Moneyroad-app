import { Pressable, ScrollView, Text, View } from "react-native";
import { Gradient } from "@/features/moneyroad/charts";
import { MrHeader, MrScreen } from "@/features/moneyroad/components";
import { notifications, signals, stocks } from "@/features/moneyroad/data";
import { Icon, type IconProps } from "@/features/moneyroad/icons";
import { nav } from "@/features/moneyroad/nav";
import { type MrTokens, useMrTheme } from "@/features/moneyroad/theme";

interface RowProps {
  badge?: number;
  color?: string;
  icon: (p: IconProps) => React.JSX.Element;
  label: string;
  onPress?: () => void;
  t: MrTokens;
  value?: string;
}

function Row({
  icon: RowIcon,
  label,
  value,
  badge,
  color,
  onPress,
  t,
}: RowProps) {
  return (
    <Pressable
      android_ripple={{ color: t.bgSubtle }}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: pressed ? t.bgSubtle : t.bg,
        borderBottomWidth: 1,
        borderBottomColor: t.border,
      })}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: color ?? t.bgSubtle,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <RowIcon color={color ? "#fff" : t.fgMuted} size={18} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "700", color: t.fgStrong }}>
          {label}
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {badge != null && badge > 0 ? (
          <View
            style={{
              minWidth: 18,
              height: 18,
              paddingHorizontal: 6,
              borderRadius: 999,
              backgroundColor: t.upStrong,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: "800", color: "#fff" }}>
              {badge}
            </Text>
          </View>
        ) : null}
        {value ? (
          <Text style={{ fontSize: 13, color: t.fgMuted, fontWeight: "600" }}>
            {value}
          </Text>
        ) : null}
        <Icon.chevRight color={t.fgSubtle} size={16} />
      </View>
    </Pressable>
  );
}

function GroupLabel({ label, t }: { label: string; t: MrTokens }) {
  return (
    <Text
      style={{
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 6,
        fontSize: 11,
        fontWeight: "800",
        color: t.fgMuted,
        letterSpacing: 0.3,
      }}
    >
      {label}
    </Text>
  );
}

export default function MyPageScreen() {
  const { t } = useMrTheme();
  const watchedCount = stocks.filter((s) => s.watched).length;
  const unreadCount = notifications.filter((n) => n.unread).length;
  const statItems = [
    { l: "관심 종목", v: watchedCount, u: "개" },
    { l: "활성 시그널", v: signals.length, u: "건" },
    { l: "안 읽은 알림", v: unreadCount, u: "건" },
  ];

  return (
    <MrScreen>
      <MrHeader title="마이" />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 18,
          }}
        >
          <Gradient
            borderRadius={999}
            colors={[t.primary, t.sigAi]}
            style={{
              width: 56,
              height: 56,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: "800", color: "#fff" }}>
              김
            </Text>
          </Gradient>
          <View style={{ flex: 1 }}>
            <Text
              style={{ fontSize: 16, fontWeight: "800", color: t.fgStrong }}
            >
              김투자
            </Text>
            <Text style={{ fontSize: 12, color: t.fgMuted, marginTop: 2 }}>
              moneyroad@example.com
            </Text>
          </View>
          <Pressable
            style={{
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 8,
              backgroundColor: t.bgSubtle,
            }}
          >
            <Text
              style={{ fontSize: 12, fontWeight: "700", color: t.fgStrong }}
            >
              프로필
            </Text>
          </Pressable>
        </View>

        {/* Stats */}
        <View
          style={{
            marginHorizontal: 16,
            marginBottom: 18,
            paddingVertical: 14,
            flexDirection: "row",
            backgroundColor: t.bgSubtle,
            borderRadius: 12,
          }}
        >
          {statItems.map((s, i) => (
            <View
              key={s.l}
              style={{
                flex: 1,
                alignItems: "center",
                gap: 2,
                borderLeftWidth: i > 0 ? 1 : 0,
                borderLeftColor: t.border,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "baseline", gap: 2 }}
              >
                <Text
                  style={{ fontSize: 20, fontWeight: "800", color: t.fgStrong }}
                >
                  {s.v}
                </Text>
                <Text
                  style={{ fontSize: 11, fontWeight: "700", color: t.fgMuted }}
                >
                  {s.u}
                </Text>
              </View>
              <Text
                style={{ fontSize: 11, color: t.fgMuted, fontWeight: "600" }}
              >
                {s.l}
              </Text>
            </View>
          ))}
        </View>

        <GroupLabel label="알림 관리" t={t} />
        <Row
          badge={unreadCount}
          icon={Icon.bell}
          label="알림함"
          onPress={nav.openAlerts}
          t={t}
        />
        <Row
          icon={Icon.alert}
          label="시그널 알림 설정"
          onPress={() => nav.openSettings("signal-alert")}
          t={t}
        />
        <Row
          icon={Icon.navNews}
          label="뉴스·공시 알림 설정"
          onPress={() => nav.openSettings("news-alert")}
          t={t}
        />
        <Row
          icon={Icon.trending}
          label="가격 알림 (목표가·도달가)"
          onPress={() => nav.openSettings("price-alert")}
          t={t}
        />

        <GroupLabel label="투자 환경" t={t} />
        <Row
          icon={Icon.navWatch}
          label="관심 종목 관리"
          onPress={nav.openWatchlist}
          t={t}
          value={`${watchedCount}개`}
        />
        <Row
          icon={Icon.sigAi}
          label="AI 시그널 학습 데이터"
          onPress={() => nav.openSettings("ai")}
          t={t}
        />
        <Row
          icon={Icon.sliders}
          label="화면 표시 설정"
          onPress={() => nav.openSettings("display")}
          t={t}
        />

        <GroupLabel label="계정" t={t} />
        <Row
          icon={Icon.navDiscuss}
          label="내가 쓴 글·답글"
          onPress={() => nav.openSettings("posts")}
          t={t}
        />
        <Row
          icon={Icon.share}
          label="공유 및 친구 초대"
          onPress={() => nav.openSettings("invite")}
          t={t}
        />
        <Row
          icon={Icon.alert}
          label="공지사항 및 고객 지원"
          onPress={() => nav.openSettings("support")}
          t={t}
        />

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingTop: 20,
            paddingBottom: 8,
          }}
        >
          <Text style={{ fontSize: 11, color: t.fgSubtle }}>버전 1.4.2</Text>
          <Text style={{ fontSize: 11, color: t.fgSubtle }}>로그아웃</Text>
        </View>
        <Text
          style={{
            paddingHorizontal: 16,
            paddingBottom: 16,
            fontSize: 10,
            lineHeight: 16,
            color: t.fgSubtle,
          }}
        >
          머니로드가 제공하는 시그널·요약·점수는 투자자의 판단을 돕는 정보이며
          매매 권유가 아닙니다. 모든 투자의 책임은 투자자 본인에게 있습니다.
        </Text>
        <View style={{ height: 16 }} />
      </ScrollView>
    </MrScreen>
  );
}
