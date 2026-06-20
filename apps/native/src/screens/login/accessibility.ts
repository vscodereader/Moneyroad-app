type AuthMode = "signin" | "signup";

export function getAuthModeSwitchAccessibility(mode: AuthMode): {
  hint: string;
  label: string;
} {
  if (mode === "signup") {
    return {
      hint: "로그인 화면으로 전환합니다.",
      label: "로그인",
    };
  }

  return {
    hint: "회원가입 화면으로 전환합니다.",
    label: "회원가입",
  };
}
