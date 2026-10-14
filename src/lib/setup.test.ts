import { test } from "node:test";
import assert from "node:assert/strict";
import { setupTokenConfigured, tokenMatches } from "./setup";

test("setup requires a long SETUP_TOKEN and an exact match", () => {
  const token = "x".repeat(32);
  assert.equal(setupTokenConfigured({}), false);
  assert.equal(setupTokenConfigured({ SETUP_TOKEN: "short" }), false);
  assert.equal(setupTokenConfigured({ SETUP_TOKEN: token }), true);
  assert.equal(tokenMatches(token, { SETUP_TOKEN: token }), true);
  assert.equal(tokenMatches(token + "y", { SETUP_TOKEN: token }), false);
  assert.equal(tokenMatches("", { SETUP_TOKEN: "" }), false);
  assert.equal(tokenMatches("short", { SETUP_TOKEN: "short" }), false);
});
