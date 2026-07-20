const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DEFAULT_MODEL,
  PROMPT_VERSION,
  buildOpenAIRequest,
  normalizeAnalysis,
  validateModelOutput,
} = require("../extension/shared/analysis-contract.js");

function validAnalysis(overrides = {}) {
  return {
    score: 84,
    recommendation: "apply",
    confidence: "high",
    summary: "The role is a strong overall match.",
    positiveMatches: [
      {
        title: "Backend experience",
        explanation: "The user's background matches the central work.",
        evidence: "Build and maintain backend APIs",
      },
    ],
    concerns: [],
    hardBlockers: [],
    uncertainties: ["The working arrangement is not stated."],
    postingLanguage: "German",
    languageRequirements: [],
    ...overrides,
  };
}

test("accepts a complete normalized model output", () => {
  assert.deepEqual(validateModelOutput(validAnalysis()), {
    valid: true,
    errors: [],
  });
});

test("rejects a recommendation that conflicts with its score", () => {
  const result = validateModelOutput(
    validAnalysis({ score: 72, recommendation: "apply" }),
  );

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("recommendation does not match the score band."));
});

test("requires hard blockers to produce a skip below 60", () => {
  const blocker = {
    title: "Mandatory language",
    explanation: "The posting explicitly conflicts with a deal-breaker.",
    evidence: "German fluency is required",
  };
  const result = validateModelOutput(
    validAnalysis({ hardBlockers: [blocker] }),
  );

  assert.equal(result.valid, false);
  assert.ok(
    result.errors.includes("A hard blocker requires a skip recommendation below 60."),
  );
});

test("builds a private structured GPT-5.6 Responses request", () => {
  const request = buildOpenAIRequest({
    userCriteria: "I prefer backend roles.",
    preferredLanguage: "English",
    job: {
      description: "Backend API development",
      application: {
        method: "easy_apply",
        label: "Easy Apply",
        confidence: "high",
      },
    },
  });

  assert.equal(request.model, DEFAULT_MODEL);
  assert.equal(request.store, false);
  assert.equal(request.reasoning.effort, "low");
  assert.equal(request.text.format.type, "json_schema");
  assert.equal(request.text.format.strict, true);
  assert.match(request.input, /Backend API development/);
  assert.match(request.input, /easy_apply/);
  assert.equal(PROMPT_VERSION, "job-fit-v2");
});

test("attaches trusted provider metadata outside the model output", () => {
  const normalized = normalizeAnalysis(validAnalysis(), {
    id: "openai",
    model: "gpt-5.6-sol",
    responseId: "resp_test",
  });

  assert.equal(normalized.promptVersion, PROMPT_VERSION);
  assert.equal(normalized.provider.model, "gpt-5.6-sol");
  assert.equal(normalized.provider.responseId, "resp_test");
});
