import { useMutation } from "@tanstack/react-query";
import { type Href, router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import { Gradient } from "@/components/charts";
import { useMrTheme } from "@/hooks/use-mr-theme";
import { authClient } from "@/lib/auth-client";
import { getRegisteredPushToken } from "@/lib/push";
import {
  SettingsGroup,
  SettingsRow,
  SettingsScreen,
} from "@/screens/settings/ui";
import { nav } from "@/utils/nav";
import { client } from "@/utils/orpc";

const NAME_MAX = 30;

export default function ProfileScreen() {
  const { t } = useMrTheme();
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const currentName = user?.name?.trim() ?? "";
  const email = user?.email ?? "";
  const avatarUrl = user?.image ?? null;
  const initial = (currentName || "사용자").charAt(0).toUpperCase();

  const [name, setName] = useState(user?.name ?? "");

  const updateName = useMutation({
    mutationFn: async (newName: string) => {
      const res = await authClient.updateUser({ name: newName });
      if (res.error) {
        throw new Error(res.error.message ?? "프로필 업데이트 실패");
      }
      return res.data;
    },
    onSuccess: () => nav.back(),
  });

  const signOut = useMutation({
    mutationFn: async () => {
      const token = getRegisteredPushToken();
      if (token) {
        await client.notification.unregisterPushToken({ token }).catch(() => {
          // best-effort cleanup before ending the session
        });
      }
      const res = await authClient.signOut();
      if (res?.error) {
        throw new Error(res.error.message ?? "로그아웃 실패");
      }
      return res?.data;
    },
    onSuccess: () => {
      router.replace("/(moneyroad)/login" as Href);
    },
  });

  const deleteAccount = useMutation({
    mutationFn: async () => {
      const token = getRegisteredPushToken();
      if (token) {
        await client.notification.unregisterPushToken({ token }).catch(() => {
          // best-effort cleanup; account deletion should continue
        });
      }
      const res = await authClient.deleteUser({});
      if (res.error) {
        throw new Error(res.error.message ?? "계정 삭제 실패");
      }
      return res.data;
    },
    onSuccess: () => {
      Alert.alert("계정 삭제 완료", "계정이 삭제되었습니다.", [
        {
          text: "확인",
          onPress: () => router.replace("/(moneyroad)/login" as Href),
        },
      ]);
    },
  });

  const deleting = deleteAccount.isPending;
  const loggingOut = signOut.isPending;
  const trimmed = name.trim();
  const canSave =
    trimmed.length > 0 && trimmed !== currentName && !updateName.isPending;

  const handleLogout = () => {
    Alert.alert("로그아웃", "로그아웃 하시겠어요?", [
      { text: "취소", style: "cancel" },
      {
        text: "로그아웃",
        style: "destructive",
        onPress: () => signOut.mutate(),
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "계정 삭제",
      "계정을 삭제하면 관심 종목, 알림 설정, 세션 정보가 함께 삭제됩니다. 이 작업은 되돌릴 수 없습니다.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: () => deleteAccount.mutate(),
        },
      ]
    );
  };

  return (
    <SettingsScreen title="프로필">
      <View style={{ alignItems: "center", paddingTop: 24, paddingBottom: 8 }}>
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={{ width: 80, height: 80, borderRadius: 999 }}
          />
        ) : (
          <Gradient
            borderRadius={999}
            colors={[t.primary, t.sigAi]}
            style={{
              width: 80,
              height: 80,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 30, fontWeight: "800", color: "#fff" }}>
              {initial}
            </Text>
          </Gradient>
        )}
      </View>

      <SettingsGroup label="이름">
        <View style={{ paddingHorizontal: 16 }}>
          <TextInput
            maxLength={NAME_MAX}
            onChangeText={setName}
            placeholder="이름을 입력해 주세요."
            placeholderTextColor={t.fgSubtle}
            style={{
              backgroundColor: t.bgSubtle,
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontSize: 15,
              color: t.fgStrong,
              fontWeight: "600",
            }}
            value={name}
          />
          <Text
            style={{
              fontSize: 11,
              color: t.fgSubtle,
              marginTop: 4,
              textAlign: "right",
            }}
          >
            {name.length}/{NAME_MAX}
          </Text>
        </View>
      </SettingsGroup>

      <SettingsGroup label="이메일">
        <View style={{ paddingHorizontal: 16 }}>
          <View
            style={{
              backgroundColor: t.bgMuted,
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 12,
            }}
          >
            <Text style={{ fontSize: 15, color: t.fgMuted }}>
              {email || "-"}
            </Text>
          </View>
          <Text style={{ fontSize: 11, color: t.fgSubtle, marginTop: 4 }}>
            이메일은 변경할 수 없습니다.
          </Text>
        </View>
      </SettingsGroup>

      <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
        <Pressable
          disabled={!canSave}
          onPress={() => updateName.mutate(trimmed)}
          style={{
            height: 48,
            borderRadius: 12,
            backgroundColor: canSave ? t.primary : t.borderStrong,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {updateName.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ fontSize: 15, fontWeight: "800", color: "#fff" }}>
              저장
            </Text>
          )}
        </Pressable>
        {updateName.isError ? (
          <Text
            style={{
              marginTop: 10,
              fontSize: 12,
              color: t.downStrong,
              textAlign: "center",
            }}
          >
            저장 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.
          </Text>
        ) : null}
      </View>
      <SettingsGroup label="계정">
        <SettingsRow
          label="로그아웃"
          onPress={loggingOut || deleting ? undefined : handleLogout}
          right={loggingOut ? <ActivityIndicator color={t.primary} /> : null}
          sub="현재 기기에서 세션을 종료합니다."
        />
        <SettingsRow
          label="계정삭제"
          onPress={loggingOut || deleting ? undefined : handleDeleteAccount}
          right={deleting ? <ActivityIndicator color={t.primary} /> : null}
          sub="계정과 관련 데이터를 삭제합니다."
        />
      </SettingsGroup>
      {signOut.isError || deleteAccount.isError ? (
        <Text
          style={{
            marginTop: 10,
            paddingHorizontal: 16,
            fontSize: 12,
            color: t.downStrong,
            textAlign: "center",
          }}
        >
          요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.
        </Text>
      ) : null}
      <View style={{ height: 24 }} />
    </SettingsScreen>
  );
}
