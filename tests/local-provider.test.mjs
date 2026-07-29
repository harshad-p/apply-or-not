import test from "node:test";
import assert from "node:assert/strict";
import {
  LOCAL_DESCRIPTION_MAX_LENGTH,
  analyzeWithLocalModel,
  buildChatCompletionsUrl,
  buildLocalSummary,
  compactLocalDescription,
  evidenceAppearsInJob,
  explicitCriteriaDimensions,
  expandLocalAnalysis,
  extractLocalOutputText,
  parseLocalResponse,
  parseLanguageExtractionResponse,
  trustedPostingLanguage,
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
    languageRequirementStatus: "none",
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

test("guards local applicability with explicit preference text", () => {
  assert.deepEqual(
    explicitCriteriaDimensions(`Match C# and .NET.
Prefer English or optional German.
Easy Apply is convenient but not required.`),
    {
      workArrangement: false,
      language: true,
      seniority: false,
      applicationMethod: false,
      otherPreferences: false,
    },
  );
  assert.equal(
    explicitCriteriaDimensions("I require remote work and Easy Apply.")
      .workArrangement,
    true,
  );
  assert.equal(
    explicitCriteriaDimensions("I require remote work and Easy Apply.")
      .applicationMethod,
    true,
  );
  assert.equal(
    explicitCriteriaDimensions("I only want aviation companies.")
      .otherPreferences,
    true,
  );
});

test("corrects obvious posting-language mistakes without translating", () => {
  assert.equal(
    trustedPostingLanguage(
      "The team will build software with strong engineering skills and experience. The job requires APIs and the role will work with product teams.",
      "German",
    ),
    "English",
  );
  assert.equal(
    trustedPostingLanguage(
      "Wir suchen Sie für die Entwicklung. Die Erfahrung und Kenntnisse mit der Software sind wichtig und das Team arbeitet auf Deutsch.",
      "English",
    ),
    "German",
  );
});

test("validates original-language evidence without interpreting its grammar", () => {
  assert.equal(
    evidenceAppearsInJob(
      "“Sehr gute Deutschkenntnisse in Wort und Schrift”",
      "Sehr gute Deutschkenntnisse in Wort und Schrift\nGute Englischkenntnisse",
    ),
    true,
  );
});

test("uses semantic language requirements returned by the local model", () => {
  const analysis = expandLocalAnalysis({
    ...modelOutput(),
    rubric: {
      ...modelOutput().rubric,
      language: { applicable: true, outcome: "conflict" },
    },
    languageRequirementStatus: "found",
    languageRequirements: [
      {
        language: "German",
        level: "very good written and spoken",
        requirement: "required",
        evidence: "Sehr gute Deutschkenntnisse in Wort und Schrift",
      },
      {
        language: "English",
        level: "good",
        requirement: "required",
        evidence: "Gute Englischkenntnisse",
      },
    ],
  }, {
    userCriteria: `Match me with C# and .NET.
Prefer positions where English is the working language or German is optional.
Strongly reduce the score when fluent German, C1, or business-level German is an explicit hard requirement.`,
    job: {
      description: `Build backend APIs with C#.
Sehr gute Deutschkenntnisse in Wort und Schrift
Gute Englischkenntnisse`,
    },
  });

  assert.equal(analysis.rubric.language.applicable, true);
  assert.equal(analysis.rubric.language.outcome, "conflict");
  assert.equal(analysis.score, 73);
  assert.equal(
    analysis.summary,
    "Potential match, led by skills. Language concern: the posting requires German and English.",
  );
  assert.equal(analysis.languageRequirements.length, 2);
});

test("builds a deterministic local summary from trusted classifications", () => {
  assert.equal(
    buildLocalSummary(
      90,
      {
        skills: { applicable: true, outcome: "match" },
        workArrangement: { applicable: false, outcome: "unknown" },
        language: { applicable: true, outcome: "unknown" },
        seniority: { applicable: false, outcome: "unknown" },
        applicationMethod: { applicable: false, outcome: "unknown" },
        otherPreferences: { applicable: false, outcome: "unknown" },
      },
      [],
      {},
      "none",
    ),
    "Strong overall match, led by skills. No explicit language requirement was found in the posting.",
  );
  assert.equal(
    buildLocalSummary(
      90,
      {
        skills: { applicable: true, outcome: "match" },
        language: { applicable: true, outcome: "unknown" },
      },
      [],
      {},
      "uncertain",
    ),
    "Strong overall match, led by skills. The local model could not confidently determine the language requirements.",
  );
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

test("normalizes focused language extraction structural consistency", () => {
  assert.deepEqual(
    parseLanguageExtractionResponse({
      choices: [
        {
          message: {
            content: JSON.stringify({
              status: "uncertain",
              postingLanguage: "German",
              outcome: "conflict",
              requirements: [
                {
                  language: "German",
                  level: "Very good",
                  requirement: "required",
                  evidence: "Sehr gute Deutschkenntnisse",
                  fit: "conflict",
                },
              ],
            }),
          },
        },
      ],
    }),
    {
      status: "found",
      postingLanguage: "German",
      outcome: "conflict",
      requirements: [
        {
          language: "German",
          level: "Very good",
          requirement: "required",
          evidence: "Sehr gute Deutschkenntnisse",
        },
      ],
    },
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
