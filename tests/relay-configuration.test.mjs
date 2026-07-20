import test from "node:test";
import assert from "node:assert/strict";
import {
  isAllowedOrigin,
  isExtensionOrigin,
  validateApiKey,
} from "../local-relay/configuration.mjs";

test("allows supported extension origins and rejects ordinary webpages", () => {
  assert.equal(isExtensionOrigin("safari-web-extension://demo-id"), true);
  assert.equal(isExtensionOrigin("chrome-extension://demo-id"), true);
  assert.equal(isAllowedOrigin("https://example.com"), false);
});

test("accepts a plausible key without exposing or transforming it", () => {
  const key = `sk-test-${"x".repeat(24)}`;
  assert.equal(validateApiKey(`  ${key}  `), key);
  assert.throws(() => validateApiKey("too-short"), /valid OpenAI API key/);
});
