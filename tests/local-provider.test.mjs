import test from "node:test";
import assert from "node:assert/strict";
import {
  LOCAL_DESCRIPTION_MAX_LENGTH,
  analyzeWithLocalModel,
  buildChatCompletionsUrl,
  compactLocalDescription,
  extractLocalOutputText,
  parseLocalResponse,
} from "../local-relay/local-provider.mjs";

function modelOutput() {
  return {
    score: 12,
    recommendation: "skip",
    rubric: {
      skills: { applicable: true, outcome: "match" },
      workArrangement: { applicable: false, outcome: "unknown" },
      language: { applicable: false, outcome: "unknown" },
      seniority: { applicable: false, outcome: "unknown" },
      applicationMethod: { applicable: false, outcome: "unknown" },
      otherPreferences: { applicable: false, outcome: "unknown" },
    },
    confidence: "high",
    summary: "The backend work matches the user's experience.",
    positiveMatches: [
      {
        title: "Backend experience",
        explanation: "The central technologies match.",
        evidence: "C# and .NET",
      },
    ],
    concerns: [],
    hardBlockers: [],
    uncertainties: [],
    postingLanguage: "English",
    languageRequirements: [],
  };
}

function payload() {
  return {
    userCriteria: "I prefer backend roles.",
    preferredLanguage: "English",
    job: { description: "Build backend APIs with C# and .NET." },
  };
}

const providerConfig = {
  id: "local",
  baseUrl: "http://127.0.0.1:11434/v1",
  model: "qwen3:8b",
};

test("builds the standard local chat-completions endpoint", () => {
  assert.equal(
    buildChatCompletionsUrl("http://127.0.0.1:11434/v1/"),
    "http://127.0.0.1:11434/v1/chat/completions",
  );
});

test("compacts oversized job text for local inference", () => {
  const description = "A".repeat(30_000);
  const compacted = compactLocalDescription(description);

  assert.ok(compacted.length <= LOCAL_DESCRIPTION_MAX_LENGTH);
  assert.match(compacted, /page text omitted/);
  assert.ok(compacted.startsWith("A".repeat(100)));
  assert.ok(compacted.endsWith("A".repeat(100)));
});

test("extracts standard and content-part local responses", () => {
  assert.equal(
    extractLocalOutputText({
      choices: [{ message: { content: '{"ok":true}' } }],
    }),
    '{"ok":true}',
  );
  assert.equal(
    extractLocalOutputText({
      choices: [
        {
          message: {
            content: [{ type: "text", text: '{"ok":true}' }],
          },
        },
      ],
    }),
    '{"ok":true}',
  );
});

test("normalizes a local response with trusted provider metadata", () => {
  const result = parseLocalResponse(
    {
      id: "chatcmpl_local",
      model: "qwen3:8b",
      choices: [{ message: { content: JSON.stringify(modelOutput()) } }],
    },
    providerConfig,
    payload(),
  );

  assert.equal(result.score, 100);
  assert.equal(result.recommendation, "apply");
  assert.equal(result.provider.id, "local");
  assert.equal(result.provider.model, "qwen3:8b");
  assert.equal(result.provider.responseId, "chatcmpl_local");
});

test("sends a schema-constrained request to the configured loopback server", async () => {
  let capturedRequest;
  let capturedMetrics;
  const result = await analyzeWithLocalModel(payload(), providerConfig, {
    fetchImpl: async (url, options) => {
      capturedRequest = { url, options };
      return {
        ok: true,
        json: async () => ({
          id: "chatcmpl_mock",
          model: "qwen3:8b",
          choices: [{ message: { content: JSON.stringify(modelOutput()) } }],
          usage: {
            prompt_tokens: 400,
            completion_tokens: 200,
            total_tokens: 600,
          },
        }),
      };
    },
    onMetrics: (metrics) => {
      capturedMetrics = metrics;
    },
  });
  const requestBody = JSON.parse(capturedRequest.options.body);

  assert.equal(
    capturedRequest.url,
    "http://127.0.0.1:11434/v1/chat/completions",
  );
  assert.equal(requestBody.model, "qwen3:8b");
  assert.equal(requestBody.response_format.type, "json_schema");
  assert.equal(requestBody.stream, false);
  assert.equal(result.provider.id, "local");
  assert.equal(capturedMetrics.promptTokens, 400);
  assert.equal(capturedMetrics.completionTokens, 200);
});

test("explains when a local model ignores structured output", () => {
  assert.throws(
    () =>
      parseLocalResponse(
        {
          choices: [{ message: { content: "not JSON" } }],
        },
        providerConfig,
        payload(),
      ),
    /supports structured output/,
  );
});

test("propagates external cancellation to the local model request", async () => {
  const controller = new AbortController();
  const operation = analyzeWithLocalModel(payload(), providerConfig, {
    signal: controller.signal,
    fetchImpl: async (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      }),
  });

  controller.abort();
  await assert.rejects(operation, /canceled/);
});
