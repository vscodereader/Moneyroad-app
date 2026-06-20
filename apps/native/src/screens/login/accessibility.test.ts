import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getAuthModeSwitchAccessibility } from "./accessibility";

describe("getAuthModeSwitchAccessibility", () => {
  it("uses the visible sign-up link text as the accessibility label", () => {
    assert.deepEqual(getAuthModeSwitchAccessibility("signin"), {
      hint: "회원가입 화면으로 전환합니다.",
      label: "회원가입",
    });
  });

  it("uses the visible sign-in link text as the accessibility label", () => {
    assert.deepEqual(getAuthModeSwitchAccessibility("signup"), {
      hint: "로그인 화면으로 전환합니다.",
      label: "로그인",
    });
  });
});
