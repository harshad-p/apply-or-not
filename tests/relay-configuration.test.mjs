import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_LOCAL_BASE_URL,
  isAllowedOrigin,
  isExtensionOrigin,
  validateApiKey,
  validateLocalBaseUrl,
  validateProviderConfig,
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

test("accepts only loopback local-model endpoints", () => {
  assert.equal(
    validateLocalBaseUrl("http://localhost:1234/v1/"),
    "http://localhost:1234/v1",
  );
  assert.equal(
    validateLocalBaseUrl(DEFAULT_LOCAL_BASE_URL),
    DEFAULT_LOCAL_BASE_URL,
  );
  assert.throws(
    () => validateLocalBaseUrl("https://example.com/v1"),
    /localhost or a loopback address/,
  );
  assert.throws(
    () => validateLocalBaseUrl("http://user:secret@127.0.0.1:1234/v1"),
    /localhost or a loopback address/,
  );
});

test("requires a model only for the local provider", () => {
  assert.deepEqual(validateProviderConfig({ id: "openai" }), {
    id: "openai",
  });
  assert.deepEqual(
    validateProviderConfig({
      id: "local",
      baseUrl: "http://127.0.0.1:11434/v1",
      model: " qwen3:8b ",
    }),
    {
      id: "local",
      baseUrl: "http://127.0.0.1:11434/v1",
      model: "qwen3:8b",
    },
  );
  assert.throws(
    () =>
      validateProviderConfig({
        id: "local",
        baseUrl: DEFAULT_LOCAL_BASE_URL,
        model: "",
      }),
    /model identifier/,
  );
});
