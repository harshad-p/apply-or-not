const test = require("node:test");
const assert = require("node:assert/strict");
const alternativeSkillsFixture = require("./fixtures/alternative-skills.json");

const {
  DEFAULT_MODEL,
  PROMPT_VERSION,
  SUMMARY_MAX_LENGTH,
  buildFastLocalRequest,
  buildLanguageExtractionRequest,
  buildOpenAICompatibleRequest,
  buildOpenAIRequest,
  calculateRubricScore,
  compactSummary,
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

test("closed applications force a zero score and skip recommendation", () => {
  const context = {
    job: {
      application: {
        status: "closed",
        statusLabel: "No longer accepting applications",
      },
    },
  };
  const normalized = normalizeAnalysis(
    validAnalysis(),
    { id: "openai", model: "gpt-5.6-sol" },
    context,
  );

  assert.equal(normalized.score, 0);
  assert.equal(normalized.recommendation, "skip");
  assert.match(normalized.hardBlockers[0].title, /applications closed/i);
  assert.deepEqual(validateModelOutput(normalized, context), {
    valid: true,
    errors: [],
  });
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
        status: "closed",
        statusLabel: "No longer accepting applications",
        statusConfidence: "high",
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
  assert.match(request.input, /No longer accepting applications/);
  assert.match(request.input, /companyContext/);
  assert.match(request.input, /companyEvidenceSource/);
  assert.equal(PROMPT_VERSION, "job-fit-v29");
  assert.match(request.instructions, /transferable skills/i);
  assert.match(request.instructions, /satisfying one acceptable option fully satisfies/i);
  assert.match(request.instructions, /Java and C\+\+ are not missing skills/i);
  assert.match(request.instructions, /SQL Server experience is relevant evidence for PostgreSQL/i);
  assert.match(request.instructions, /only OpenAI/i);
  assert.match(request.instructions, /extracted page-control evidence/i);
  assert.match(request.instructions, /score of 0/i);
  assert.match(request.instructions, /Page evidence never makes a dimension applicable/i);
  assert.match(request.instructions, /Never describe unknown application availability as open/i);
  assert.match(request.instructions, /one or two concise sentences/i);
  assert.equal(request.text.format.schema.properties.summary.maxLength, 240);
});

test("preserves the alternative-skills regression rule in both provider prompts", () => {
  const payload = {
    userCriteria: alternativeSkillsFixture.userCriteria,
    preferredLanguage: "English",
    job: alternativeSkillsFixture.job,
  };
  const openAIRequest = buildOpenAIRequest(payload);
  const localRequest = buildOpenAICompatibleRequest(payload, "qwen3:4b-instruct");

  assert.match(openAIRequest.input, /at least one modern language such as Java, C\+\+, or C#/);
  assert.match(localRequest.messages[1].content, /at least one modern language such as Java, C\+\+, or C#/);
  assert.match(openAIRequest.instructions, /user with C# fully matches that requirement/i);
  assert.match(localRequest.messages[0].content, /user with C# fully matches that requirement/i);
  assert.deepEqual(alternativeSkillsFixture.expected, {
    skillsOutcome: "match",
    missingSkills: [],
    concern: false,
  });
});

test("builds a structured OpenAI-compatible local request", () => {
  const request = buildOpenAICompatibleRequest(
    {
      userCriteria: "I prefer backend roles.",
      preferredLanguage: "English",
      job: { description: "Backend API development" },
    },
    "qwen3:8b",
  );

  assert.equal(request.model, "qwen3:8b");
  assert.equal(request.stream, false);
  assert.equal(request.temperature, 0);
  assert.equal(request.reasoning_effort, "none");
  assert.equal(request.max_tokens, 1800);
  assert.equal(request.messages[0].role, "system");
  assert.match(request.messages[1].content, /Backend API development/);
  assert.equal(request.response_format.type, "json_schema");
  assert.equal(request.response_format.json_schema.strict, true);
});

test("builds a compact classification-first request for local inference", () => {
  const request = buildFastLocalRequest(
    {
      userCriteria: "I prefer backend roles.",
      preferredLanguage: "English",
      job: { description: "Backend API development" },
    },
    "qwen3:0.6b",
  );

  assert.equal(request.model, "qwen3:0.6b");
  assert.equal(request.max_tokens, 220);
  assert.match(request.messages[0].content, /C# satisfies/);
  assert.match(
    request.messages[0].content,
    /Blazor is a \.NET UI framework, not a JavaScript-framework requirement/,
  );
  assert.match(request.messages[0].content, /Never infer a human-language/);
  assert.match(
    request.messages[0].content,
    /one item for EACH named language/,
  );
  assert.match(request.messages[0].content, /Deutsch und Englisch/);
  assert.equal(
    request.response_format.json_schema.schema.properties.score,
    undefined,
  );
  assert.equal(
    request.response_format.json_schema.schema.properties.summary,
    undefined,
  );
  assert.deepEqual(
    request.response_format.json_schema.schema.properties.rubric.properties
      .skills.enum,
    [
      "not_applicable",
      "match",
      "partial",
      "unknown",
      "gap",
      "conflict",
    ],
  );
  assert.deepEqual(
    request.response_format.json_schema.schema.properties
      .language.properties.status.enum,
    ["found", "none", "uncertain"],
  );
  assert.equal(
    request.response_format.json_schema.schema.properties.confidence,
    undefined,
  );
});

test("uses a prepared local profile without discarding the raw source criteria", () => {
  const request = buildFastLocalRequest(
    {
      userCriteria:
        "Match me with C# and .NET. Strongly reduce fluent German requirements.",
      preparedUserCriteria:
        "Skills: C#; .NET\nPenalize: fluent German required",
      preferredLanguage: "English",
      job: { description: "C# software development" },
    },
    "llama3.2:3b",
  );

  assert.match(request.messages[1].content, /Skills: C#; \.NET/);
  assert.doesNotMatch(request.messages[1].content, /Match me with/);
});

test("builds a focused language fit request with separated inputs", () => {
  const request = buildLanguageExtractionRequest(
    "Sehr gute Deutschkenntnisse in Wort und Schrift",
    "Prefer English; strongly reduce required fluent German.",
    "qwen3:1.7b",
  );

  assert.equal(request.model, "qwen3:1.7b");
  assert.equal(request.max_tokens, 300);
  assert.match(request.messages[0].content, /extract EVERY statement/);
  assert.match(request.messages[0].content, /do not stop after the first/);
  assert.match(request.messages[0].content, /strong reduction or deal-breaker/);
  assert.match(request.messages[1].content, /jobPosting/);
  assert.match(request.messages[1].content, /applicantLanguageCriteria/);
  assert.deepEqual(
    request.response_format.json_schema.schema.properties.status.enum,
    ["found", "none", "uncertain"],
  );
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

test("compacts verbose summaries without cutting through a word", () => {
  const verbose = `${"This role strongly matches the applicant's backend experience and stated language preferences. ".repeat(5)}Additional detail.`;
  const compact = compactSummary(verbose);

  assert.ok(compact.length <= SUMMARY_MAX_LENGTH);
  assert.match(compact, /[.!?…]$/u);
  assert.equal(compact.includes("\n"), false);
});

test("normalization enforces the popup summary limit", () => {
  const normalized = normalizeAnalysis(
    validAnalysis({ summary: "Strong match. ".repeat(80) }),
    { id: "local", model: "qwen3:4b-instruct" },
  );

  assert.ok(normalized.summary.length <= SUMMARY_MAX_LENGTH);
  assert.deepEqual(validateModelOutput(normalized), {
    valid: true,
    errors: [],
  });
});
