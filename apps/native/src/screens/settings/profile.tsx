import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import { Gradient } from "@/components/charts";
import { useMrTheme } from "@/hooks/use-mr-theme";
import { authClient } from "@/lib/auth-client";
import { SettingsGroup, SettingsScreen } from "@/screens/settings/ui";
import { nav } from "@/utils/nav";

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

  const trimmed = name.trim();
  const canSave =
    trimmed.length > 0 && trimmed !== currentName && !updateName.isPending;

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
      <View style={{ height: 24 }} />
    </SettingsScreen>
  );
}
