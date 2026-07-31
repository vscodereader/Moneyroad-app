import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildLoginHref, sanitizeReturnTo } from "./auth-navigation";

describe("sanitizeReturnTo", () => {
  it("accepts MoneyRoad routes with query parameters", () => {
    assert.equal(
      sanitizeReturnTo("/(moneyroad)/discussion-room/12?anchorId=34"),
      "/(moneyroad)/discussion-room/12?anchorId=34"
    );
  });

  it("uses only the first Expo Router parameter value", () => {
    assert.equal(
      sanitizeReturnTo([
        "/(moneyroad)/(tabs)/news?tab=watch",
        "https://example.com",
      ]),
      "/(moneyroad)/(tabs)/news?tab=watch"
    );
  });

  it("rejects external, malformed, and redirect-loop destinations", () => {
    const rejected = [
      "https://example.com",
      "//example.com",
      "moneyroad://settings",
      "/(moneyroad)/login",
      "/(moneyroad)/onboarding?step=2",
      "/(moneyroad)\\settings/profile",
      `/(moneyroad)/settings/${"a".repeat(600)}`,
    ];

    for (const value of rejected) {
      assert.equal(sanitizeReturnTo(value), null);
    }
  });
});

describe("buildLoginHref", () => {
  it("encodes the internal return destination", () => {
    assert.equal(
      buildLoginHref("/(moneyroad)/(tabs)/discuss?tab=favorite"),
      "/(moneyroad)/login?returnTo=%2F(moneyroad)%2F(tabs)%2Fdiscuss%3Ftab%3Dfavorite"
    );
  });
});
