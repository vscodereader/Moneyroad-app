import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PriceAlertControls } from "@/components/price-alert-controls";
import { Switch } from "@/components/ui";
import { useMrTheme } from "@/hooks/use-mr-theme";
import { fmt } from "@/utils/format";

export function PriceAlertSheet({
  currentPrice,
  isAuthed,
  isWatched,
  onClose,
  onSetWatched,
  stockCode,
  stockName,
  visible,
}: {
  currentPrice: number | undefined;
  isAuthed: boolean;
  isWatched: boolean;
  onClose: () => void;
  onSetWatched: (next: boolean) => void;
  stockCode: string;
  stockName: string;
  visible: boolean;
}) {
  const { t } = useMrTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.root}>
        <Pressable onPress={onClose} style={styles.backdrop} />
        <View
          style={{
            backgroundColor: t.bg,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: "88%",
            paddingBottom: insets.bottom + 12,
          }}
        >
          {/* Grabber */}
          <View
            style={{ alignItems: "center", paddingBottom: 4, paddingTop: 10 }}
          >
            <View
              style={{
                backgroundColor: t.borderStrong,
                borderRadius: 999,
                height: 5,
                width: 40,
              }}
            />
          </View>

          <ScrollView
            automaticallyAdjustKeyboardInsets
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
              <Text
                style={{
                  color: t.fgStrong,
                  fontSize: 26,
                  fontWeight: "800",
                  letterSpacing: -0.5,
                }}
              >
                가격 알림을 받을까요?
              </Text>
              <Text
                style={{
                  color: t.fgMuted,
                  fontSize: 15,
                  fontWeight: "600",
                  marginTop: 8,
                }}
              >
                {stockName} ·{" "}
                {currentPrice
                  ? `현재가 ${fmt.price(currentPrice)}원`
                  : "시세 연결 중"}
              </Text>
            </View>

            <PriceAlertControls
              currentPrice={currentPrice}
              enabled={isAuthed}
              stockCode={stockCode}
            />

            {/* Stock info (watchlist) */}
            <View
              style={{
                borderTopColor: t.border,
                borderTopWidth: 8,
                marginTop: 16,
                paddingHorizontal: 20,
                paddingVertical: 18,
              }}
            >
              <View
                style={{ alignItems: "center", flexDirection: "row", gap: 12 }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{
                      color: t.fgStrong,
                      fontSize: 18,
                      fontWeight: "800",
                    }}
                  >
                    주식 정보
                  </Text>
                  <Text
                    style={{
                      color: t.fgMuted,
                      fontSize: 13,
                      fontWeight: "600",
                      marginTop: 4,
                    }}
                  >
                    가격 변동·뉴스·회사 소식 등
                  </Text>
                </View>
                <Switch on={isWatched} onChange={onSetWatched} />
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.4)",
    flex: 1,
  },
  root: {
    flex: 1,
  },
});
