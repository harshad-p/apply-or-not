import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeWithOpenAI,
  parseOpenAIResponse,
  validatePayload,
} from "../local-relay/openai-provider.mjs";

function modelOutput() {
  return {
    score: 88,
    recommendation: "apply",
    confidence: "high",
    summary: "Strong backend match with no explicit language blocker.",
    positiveMatches: [
      {
        title: "Backend stack",
        explanation: "The required stack matches the user's experience.",
        evidence: "C# and .NET",
      },
    ],
    concerns: [],
    hardBlockers: [],
    uncertainties: [],
    postingLanguage: "English",
    languageRequirements: [
      {
        language: "English",
        level: "working language",
        requirement: "required",
        evidence: "The working language is English",
      },
    ],
  };
}

function payload() {
  return {
    userCriteria: "I prefer backend roles.",
    preferredLanguage: "English",
    job: { description: "Build backend APIs with C# and .NET." },
  };
}

test("parses and attributes a structured Responses API result", () => {
  const result = parseOpenAIResponse({
    id: "resp_fixture",
    model: "gpt-5.6-sol-2026-07-01",
    output: [
      {
        type: "message",
        content: [
          { type: "output_text", text: JSON.stringify(modelOutput()) },
        ],
      },
    ],
  });

  assert.equal(result.score, 88);
  assert.equal(result.provider.model, "gpt-5.6-sol-2026-07-01");
  assert.equal(result.provider.responseId, "resp_fixture");
});

test("sends the expected GPT-5.6 request through an injected fetch", async () => {
  let capturedRequest;
  const fetchImpl = async (url, options) => {
    capturedRequest = { url, options };
    return {
      ok: true,
      json: async () => ({
        id: "resp_mock",
        model: "gpt-5.6-sol",
        output_text: JSON.stringify(modelOutput()),
      }),
    };
  };

  const result = await analyzeWithOpenAI(payload(), {
    apiKey: "test-key-not-real",
    fetchImpl,
  });
  const requestBody = JSON.parse(capturedRequest.options.body);

  assert.equal(capturedRequest.url, "https://api.openai.com/v1/responses");
  assert.equal(requestBody.model, "gpt-5.6-sol");
  assert.equal(requestBody.store, false);
  assert.equal(requestBody.text.format.type, "json_schema");
  assert.equal(result.provider.responseId, "resp_mock");
});

test("rejects malformed model output", () => {
  assert.throws(
    () =>
      parseOpenAIResponse({
        output_text: "not-json",
        model: "gpt-5.6-sol",
      }),
    /malformed structured analysis/,
  );
});

test("rejects an empty extracted description before any API call", () => {
  assert.throws(
    () => validatePayload({ ...payload(), job: { description: "" } }),
    /description is missing/,
  );
});

test("rejects an unrecognized application method", () => {
  assert.throws(
    () =>
      validatePayload({
        ...payload(),
        job: {
          description: "A valid description",
          application: { method: "instant_apply" },
        },
      }),
    /application method is invalid/,
  );
});
