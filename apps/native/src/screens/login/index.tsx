import { type Href, router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { Icon, type IconProps } from "@/components/icons";
import { BackButton, MrHeader, MrScreen } from "@/components/ui";
import { useMrTheme } from "@/hooks/use-mr-theme";
import { authClient } from "@/lib/auth-client";
import { nav } from "@/utils/nav";
import type { MrTokens } from "@/utils/theme";

type Mode = "signin" | "signup";
type Provider = "google" | "apple" | "naver" | "kakao";

const AFTER_LOGIN = "/(moneyroad)/(tabs)/mypage";

const SOCIALS: {
  provider: Provider;
  label: string;
  bg: string;
  fg: string;
  border?: string;
  icon: (p: IconProps) => React.JSX.Element;
}[] = [
  {
    provider: "kakao",
    label: "카카오로 계속하기",
    bg: "#FEE500",
    fg: "#191600",
    icon: Icon.logoKakao,
  },
  {
    provider: "naver",
    label: "네이버로 계속하기",
    bg: "#03C75A",
    fg: "#FFFFFF",
    icon: Icon.logoNaver,
  },
  {
    provider: "google",
    label: "Google로 계속하기",
    bg: "#FFFFFF",
    fg: "#1F1F1F",
    border: "#DADCE0",
    icon: Icon.logoGoogle,
  },
  {
    provider: "apple",
    label: "Apple로 계속하기",
    bg: "#000000",
    fg: "#FFFFFF",
    icon: Icon.logoApple,
  },
];

function Field({
  label,
  t,
  ...input
}: {
  label: string;
  t: MrTokens;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 12, fontWeight: "700", color: t.fgMuted }}>
        {label}
      </Text>
      <TextInput
        placeholderTextColor={t.fgSubtle}
        style={{
          height: 48,
          borderWidth: 1,
          borderColor: t.border,
          borderRadius: 10,
          paddingHorizontal: 14,
          fontSize: 15,
          color: t.fgStrong,
          backgroundColor: t.bgSubtle,
        }}
        {...input}
      />
    </View>
  );
}

export default function LoginScreen() {
  const { t } = useMrTheme();
  const { data: session } = authClient.useSession();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<Provider | null>(null);

  // Once authenticated (email or social), leave the login screen.
  useEffect(() => {
    if (session?.user) {
      router.replace(AFTER_LOGIN as Href);
    }
  }, [session?.user]);

  const isSignup = mode === "signup";

  const submitEmail = async () => {
    if (loading) {
      return;
    }
    setError(null);
    setLoading(true);
    const handlers = {
      onError: (ctx: { error: { message?: string } }) =>
        setError(ctx.error.message ?? "요청을 처리하지 못했어요."),
    };
    try {
      if (isSignup) {
        await authClient.signUp.email(
          {
            email: email.trim(),
            password,
            name: name.trim() || email.trim(),
          },
          handlers
        );
      } else {
        await authClient.signIn.email(
          { email: email.trim(), password },
          handlers
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const submitSocial = async (provider: Provider) => {
    if (socialLoading) {
      return;
    }
    setError(null);
    setSocialLoading(provider);
    try {
      await authClient.signIn.social(
        { provider, callbackURL: AFTER_LOGIN },
        {
          onError: (ctx: { error: { message?: string } }) =>
            setError(ctx.error.message ?? "로그인에 실패했어요."),
        }
      );
    } finally {
      setSocialLoading(null);
    }
  };

  const emailValid = email.includes("@") && password.length >= 8;

  return (
    <MrScreen>
      <MrHeader
        left={<BackButton onPress={nav.back} />}
        title={isSignup ? "회원가입" : "로그인"}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 14 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text
            style={{
              fontSize: 20,
              fontWeight: "800",
              color: t.fgStrong,
              marginTop: 4,
            }}
          >
            {isSignup ? "이메일로 가입하기" : "이메일로 로그인"}
          </Text>

          {isSignup ? (
            <Field
              autoCapitalize="none"
              label="이름"
              onChangeText={setName}
              placeholder="머니로드"
              t={t}
              value={name}
            />
          ) : null}

          <Field
            autoCapitalize="none"
            autoComplete="email"
            inputMode="email"
            label="이메일"
            onChangeText={setEmail}
            placeholder="you@moneyroad.ai.kr"
            t={t}
            value={email}
          />
          <Field
            autoCapitalize="none"
            label="비밀번호 (8자 이상)"
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            t={t}
            value={password}
          />

          {error ? (
            <Text style={{ fontSize: 13, color: t.downStrong }}>{error}</Text>
          ) : null}

          <Pressable
            disabled={!emailValid || loading}
            onPress={submitEmail}
            style={{
              height: 50,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: emailValid ? t.primary : t.borderStrong,
            }}
          >
            {loading ? (
              <ActivityIndicator color={t.primaryOn} />
            ) : (
              <Text
                style={{ fontSize: 15, fontWeight: "800", color: t.primaryOn }}
              >
                {isSignup ? "회원가입" : "로그인"}
              </Text>
            )}
          </Pressable>

          <Pressable
            hitSlop={8}
            onPress={() => {
              setMode(isSignup ? "signin" : "signup");
              setError(null);
            }}
            style={{
              alignSelf: "center",
              flexDirection: "row",
              gap: 5,
              paddingVertical: 10,
            }}
          >
            <Text style={{ fontSize: 13, color: t.fgMuted }}>
              {isSignup ? "이미 계정이 있으신가요?" : "계정이 없으신가요?"}
            </Text>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "800",
                color: t.primary,
                textDecorationLine: "underline",
              }}
            >
              {isSignup ? "로그인" : "회원가입"}
            </Text>
          </Pressable>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: t.border }} />
            <Text style={{ fontSize: 12, color: t.fgSubtle }}>또는</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: t.border }} />
          </View>

          <View style={{ gap: 10 }}>
            {SOCIALS.map((s) => {
              const Logo = s.icon;
              return (
                <Pressable
                  disabled={socialLoading !== null}
                  key={s.provider}
                  onPress={() => submitSocial(s.provider)}
                  style={{
                    height: 50,
                    borderRadius: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    backgroundColor: s.bg,
                    borderWidth: s.border ? 1 : 0,
                    borderColor: s.border,
                  }}
                >
                  {socialLoading === s.provider ? (
                    <ActivityIndicator color={s.fg} />
                  ) : (
                    <>
                      <Logo color={s.fg} size={18} />
                      <Text
                        style={{ fontSize: 15, fontWeight: "700", color: s.fg }}
                      >
                        {s.label}
                      </Text>
                    </>
                  )}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </MrScreen>
  );
}
