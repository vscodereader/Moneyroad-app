import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getAppVersionLabel } from "./app-version";
import { formatAppVersionLabel } from "./app-version-format";

describe("formatAppVersionLabel", () => {
  it("formats the Expo app version for display", () => {
    assert.equal(formatAppVersionLabel("1.0.2"), "버전 1.0.2");
  });
});

describe("getAppVersionLabel", () => {
  it("uses the app.json Expo version", () => {
    assert.equal(getAppVersionLabel(), "버전 1.0.2");
  });
});
