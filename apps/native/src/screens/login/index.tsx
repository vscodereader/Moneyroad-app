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
import { z } from "zod";

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

// 아이디 정규식: better-auth username plugin 기본값(영문/숫자/_/.)을 클라이언트에서도 미리 점검.
const USERNAME_REGEX = /^[a-zA-Z0-9_.]+$/;
const USERNAME_MIN = 3;
const USERNAME_MAX = 30;
const PASSWORD_MIN = 8;

const signupSchema = z
  .object({
    username: z
      .string()
      .min(USERNAME_MIN, `아이디는 ${USERNAME_MIN}자 이상이어야 해요.`)
      .max(USERNAME_MAX, `아이디는 ${USERNAME_MAX}자 이하여야 해요.`)
      .regex(USERNAME_REGEX, "아이디는 영문/숫자/_/.만 사용할 수 있어요."),
    email: z.email("이메일 형식이 올바르지 않아요."),
    password: z
      .string()
      .min(PASSWORD_MIN, `비밀번호는 ${PASSWORD_MIN}자 이상이어야 해요.`),
    passwordConfirm: z.string(),
    name: z.string().optional(),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: "비밀번호가 일치하지 않아요.",
    path: ["passwordConfirm"],
  });

export default function LoginScreen() {
  const { t } = useMrTheme();
  const { data: session } = authClient.useSession();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
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

  const submitCredentials = async () => {
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
        const parsed = signupSchema.safeParse({
          username: username.trim(),
          email: email.trim(),
          password,
          passwordConfirm,
          name: name.trim() || undefined,
        });
        if (!parsed.success) {
          setError(
            parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요."
          );
          return;
        }
        const data = parsed.data;
        // 이름은 옵션이지만 DB는 NOT NULL이라 비어있으면 아이디로 폴백.
        await authClient.signUp.email(
          {
            email: data.email,
            password: data.password,
            name: data.name ?? data.username,
            username: data.username,
          },
          handlers
        );
      } else {
        // 입력값에 @가 있으면 이메일 로그인, 아니면 아이디 로그인.
        const identifier = username.trim();
        if (identifier.includes("@")) {
          await authClient.signIn.email(
            { email: identifier, password },
            handlers
          );
        } else {
          await authClient.signIn.username(
            { username: identifier, password },
            handlers
          );
        }
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

  // 버튼 활성화는 비어있지 않으면 OK — 상세 검증은 submit 시 zod로 처리.
  const trimmedUsername = username.trim();
  const signupReady =
    trimmedUsername.length > 0 &&
    email.trim().length > 0 &&
    password.length > 0 &&
    passwordConfirm.length > 0;
  const signinReady = trimmedUsername.length > 0 && password.length > 0;
  const canSubmit = isSignup ? signupReady : signinReady;

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
            {isSignup ? "이메일로 가입하기" : "로그인"}
          </Text>

          <Field
            autoCapitalize="none"
            autoCorrect={false}
            label={
              isSignup
                ? `아이디 (${USERNAME_MIN}~${USERNAME_MAX}자, 영문/숫자/_/.)`
                : "이메일 또는 아이디"
            }
            onChangeText={setUsername}
            placeholder={isSignup ? "moneyroad_user" : "you@moneyroad.ai.kr"}
            t={t}
            value={username}
          />
          {isSignup ? (
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
          ) : null}
          <Field
            autoCapitalize="none"
            label={`비밀번호 (${PASSWORD_MIN}자 이상)`}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            t={t}
            value={password}
          />
          {isSignup ? (
            <>
              <Field
                autoCapitalize="none"
                label="비밀번호 확인"
                onChangeText={setPasswordConfirm}
                placeholder="••••••••"
                secureTextEntry
                t={t}
                value={passwordConfirm}
              />
              <Field
                autoCapitalize="none"
                label="이름 (선택)"
                onChangeText={setName}
                placeholder="홍길동"
                t={t}
                value={name}
              />
            </>
          ) : null}

          {error ? (
            <Text style={{ fontSize: 13, color: t.downStrong }}>{error}</Text>
          ) : null}

          <Pressable
            disabled={!canSubmit || loading}
            onPress={submitCredentials}
            style={{
              height: 50,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: canSubmit ? t.primary : t.borderStrong,
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
            {/*<Text style={{ fontSize: 12, color: t.fgSubtle }}>또는</Text>*/}
            {/*<View style={{ flex: 1, height: 1, backgroundColor: t.border }} />*/}
          </View>

          {/*<View style={{ gap: 10 }}>*/}
          {/*  {SOCIALS.map((s) => {*/}
          {/*    const Logo = s.icon;*/}
          {/*    return (*/}
          {/*      <Pressable*/}
          {/*        disabled={socialLoading !== null}*/}
          {/*        key={s.provider}*/}
          {/*        onPress={() => submitSocial(s.provider)}*/}
          {/*        style={{*/}
          {/*          height: 50,*/}
          {/*          borderRadius: 12,*/}
          {/*          flexDirection: "row",*/}
          {/*          alignItems: "center",*/}
          {/*          justifyContent: "center",*/}
          {/*          gap: 8,*/}
          {/*          backgroundColor: s.bg,*/}
          {/*          borderWidth: s.border ? 1 : 0,*/}
          {/*          borderColor: s.border,*/}
          {/*        }}*/}
          {/*      >*/}
          {/*        {socialLoading === s.provider ? (*/}
          {/*          <ActivityIndicator color={s.fg} />*/}
          {/*        ) : (*/}
          {/*          <>*/}
          {/*            <Logo color={s.fg} size={18} />*/}
          {/*            <Text*/}
          {/*              style={{ fontSize: 15, fontWeight: "700", color: s.fg }}*/}
          {/*            >*/}
          {/*              {s.label}*/}
          {/*            </Text>*/}
          {/*          </>*/}
          {/*        )}*/}
          {/*      </Pressable>*/}
          {/*    );*/}
          {/*  })}*/}
          {/*</View>*/}
        </ScrollView>
      </KeyboardAvoidingView>
    </MrScreen>
  );
}
