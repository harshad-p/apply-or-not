const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DEFAULT_MODEL,
  PROMPT_VERSION,
  buildOpenAIRequest,
  calculateRubricScore,
  normalizeAnalysis,
  validateModelOutput,
} = require("../extension/shared/analysis-contract.js");

function validAnalysis(overrides = {}) {
  return {
    score: 100,
    recommendation: "apply",
    rubric: {
      skills: { applicable: true, outcome: "match" },
      workArrangement: { applicable: false, outcome: "unknown" },
      language: { applicable: false, outcome: "unknown" },
      seniority: { applicable: false, outcome: "unknown" },
      applicationMethod: { applicable: false, outcome: "unknown" },
      otherPreferences: { applicable: false, outcome: "unknown" },
    },
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

test("explicit user deal-breakers cap an otherwise strong match at 35", () => {
  const blocker = {
    title: "Employer mismatch",
    explanation: "The employer conflicts with an exclusive user preference.",
    evidence: "Northstar Systems",
  };

  assert.equal(calculateRubricScore(validAnalysis({ hardBlockers: [blocker] })), 35);
});

test("calculates a stable score from applicable rubric dimensions", () => {
  const analysis = validAnalysis({
    rubric: {
      ...validAnalysis().rubric,
      language: { applicable: true, outcome: "conflict" },
    },
  });

  assert.equal(calculateRubricScore(analysis), 73);
  assert.equal(calculateRubricScore(analysis), 73);
});

test("normalization replaces model-selected score and recommendation", () => {
  const normalized = normalizeAnalysis(
    validAnalysis({ score: 12, recommendation: "skip" }),
    { id: "openai", model: "gpt-5.6-sol" },
  );

  assert.equal(normalized.score, 100);
  assert.equal(normalized.recommendation, "apply");
});

test("unknown evidence remains in the consider band", () => {
  const analysis = validAnalysis({
    rubric: {
      ...validAnalysis().rubric,
      skills: { applicable: false, outcome: "unknown" },
      applicationMethod: { applicable: true, outcome: "unknown" },
    },
  });

  assert.equal(calculateRubricScore(analysis), 65);
});

test("no applicable criteria defaults to a neutral consider score", () => {
  const rubric = Object.fromEntries(
    Object.keys(validAnalysis().rubric).map((dimension) => [
      dimension,
      { applicable: false, outcome: "unknown" },
    ]),
  );

  assert.equal(calculateRubricScore(validAnalysis({ rubric })), 65);
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
  assert.match(request.input, /companyContext/);
  assert.match(request.input, /companyEvidenceSource/);
  assert.equal(PROMPT_VERSION, "job-fit-v6");
  assert.match(request.instructions, /transferable skills/i);
  assert.match(request.instructions, /SQL Server experience is relevant evidence for PostgreSQL/i);
  assert.match(request.instructions, /only OpenAI/i);
  assert.match(request.instructions, /extracted page-control evidence/i);
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
