import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, View } from "react-native";

import { MrBottomSheet } from "@/components/mr-bottom-sheet";
import { orpc } from "@/utils/orpc";
import type { MrTokens } from "@/utils/theme";
import { MemberActionSheet } from "./member-action-sheet";
import {
  type DurationMode,
  type DurationUnit,
  MemberDurationSheet,
} from "./member-duration-sheet";
import { MemberRow, type RoomMember } from "./member-row";

// 관리자 전용 멤버 목록 시트(RN Modal). 멤버만(아바타+이름+역할태그) 노출하며
// 미디어/고정/설정 항목은 없다. 롱프레스 → mute/차단 액션시트로 이어진다.
export function MemberListSheet({
  visible,
  roomId,
  isAdmin,
  onClose,
  t,
}: {
  visible: boolean;
  roomId: number;
  isAdmin: boolean;
  onClose: () => void;
  t: MrTokens;
}) {
  const queryClient = useQueryClient();

  const [actionTarget, setActionTarget] = useState<RoomMember | null>(null);
  const [durationTarget, setDurationTarget] = useState<RoomMember | null>(null);
  const [durationMode, setDurationMode] = useState<DurationMode | null>(null);

  const membersOptions = orpc.discussion.roomMembers.queryOptions({
    input: { roomId },
    enabled: visible && isAdmin,
  });
  const membersQuery = useQuery(membersOptions);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: membersOptions.queryKey });
    queryClient.invalidateQueries({
      queryKey: orpc.discussion.room.queryOptions({ input: { id: roomId } })
        .queryKey,
    });
  };

  const muteMutation = useMutation(
    orpc.discussion.muteMember.mutationOptions({ onSuccess: invalidate })
  );
  const blockMutation = useMutation(
    orpc.discussion.blockMember.mutationOptions({ onSuccess: invalidate })
  );

  const closeDuration = () => {
    setDurationMode(null);
    setDurationTarget(null);
  };

  const openDuration = (mode: DurationMode) => {
    setDurationTarget(actionTarget);
    setDurationMode(mode);
    setActionTarget(null);
  };

  const handleConfirm = (value: number, unit: DurationUnit) => {
    const target = durationTarget;
    if (!target) {
      return;
    }
    if (durationMode === "mute") {
      muteMutation.mutate(
        { roomId, userId: target.userId, value, unit },
        { onSuccess: closeDuration }
      );
      return;
    }
    // 차단: 강퇴 확인 Alert 후 blockMember.
    Alert.alert("강퇴", `정말 이 ${target.name}님을 강퇴하시겠습니까?`, [
      { text: "취소", style: "cancel" },
      {
        text: "확인",
        style: "destructive",
        onPress: () =>
          blockMutation.mutate(
            { roomId, userId: target.userId, value, unit },
            { onSuccess: closeDuration }
          ),
      },
    ]);
  };

  const members = membersQuery.data ?? [];

  return (
    <>
      <MrBottomSheet
        grabberPaddingBottom={4}
        grabberPaddingTop={10}
        maxHeight="88%"
        onClose={onClose}
        paddingTop={0}
        t={t}
        visible={visible}
      >
        <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
          <Text
            style={{
              color: t.fgStrong,
              fontSize: 20,
              fontWeight: "800",
              letterSpacing: -0.4,
            }}
          >
            멤버 {members.length}명
          </Text>
          <Text
            style={{
              color: t.fgMuted,
              fontSize: 13,
              fontWeight: "600",
              marginTop: 6,
            }}
          >
            멤버를 길게 눌러 뮤트하거나 차단할 수 있어요.
          </Text>
        </View>

        {membersQuery.isPending ? (
          <View style={{ paddingVertical: 40, alignItems: "center" }}>
            <ActivityIndicator color={t.primary} />
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ marginTop: 8 }}
          >
            {members.map((member) => (
              <MemberRow
                key={member.userId}
                member={member}
                onLongPress={setActionTarget}
                t={t}
              />
            ))}
            {members.length === 0 ? (
              <Text
                style={{
                  color: t.fgSubtle,
                  fontSize: 13,
                  paddingHorizontal: 20,
                  paddingVertical: 24,
                  textAlign: "center",
                }}
              >
                아직 참여한 멤버가 없습니다.
              </Text>
            ) : null}
          </ScrollView>
        )}
      </MrBottomSheet>

      <MemberActionSheet
        memberName={actionTarget?.name ?? ""}
        onBlock={() => openDuration("block")}
        onClose={() => setActionTarget(null)}
        onMute={() => openDuration("mute")}
        t={t}
        visible={actionTarget !== null}
      />
      <MemberDurationSheet
        isPending={muteMutation.isPending || blockMutation.isPending}
        memberName={durationTarget?.name ?? ""}
        mode={durationMode ?? "mute"}
        onClose={closeDuration}
        onConfirm={handleConfirm}
        t={t}
        visible={durationMode !== null}
      />
    </>
  );
}
