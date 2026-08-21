import test from "node:test";
import assert from "node:assert/strict";
import {
  LOCAL_DESCRIPTION_MAX_LENGTH,
  analyzeWithLocalModel,
  buildChatCompletionsUrl,
  buildNativeOllamaChatUrl,
  buildNativeOllamaRequest,
  compactLocalDescription,
  extractLanguageCandidateLines,
  expandCompactLocalOutput,
  extractLocalOutputText,
  parseLocalResponse,
  parseLanguageExtractionResponse,
  prepareLocalPreferences,
  preferenceProfileToText,
  profilePreservesNamedTerms,
  usesNativeOllamaQwen,
  expandNamedLanguagesFromEvidence,
  removeProgrammingLanguageFalsePositives,
} from "../local-relay/local-provider.mjs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  blockerMatchesLanguageRequirement,
  buildLocalSummary,
  evidenceAppearsInJob,
  explicitCriteriaDimensions,
  expandLocalAnalysis,
  trustedPostingLanguage,
  userExplicitlyRejectsLanguage,
  userStronglyReducesLanguage,
} = require("../extension/shared/analysis-contract.js");

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

test("uses Ollama native non-thinking mode for Qwen 3.5", () => {
  assert.equal(
    usesNativeOllamaQwen({
      baseUrl: "http://127.0.0.1:11434/v1",
      model: "qwen3.5:2b-q4_K_M",
    }),
    true,
  );
  assert.equal(
    usesNativeOllamaQwen({
      baseUrl: "http://127.0.0.1:1234/v1",
      model: "qwen3.5:2b-q4_K_M",
    }),
    false,
  );
  assert.equal(
    buildNativeOllamaChatUrl("http://127.0.0.1:11434/v1"),
    "http://127.0.0.1:11434/api/chat",
  );
  const request = buildNativeOllamaRequest({
    model: "qwen3.5:2b-q4_K_M",
    messages: [{ role: "user", content: "test" }],
    response_format: {
      json_schema: { schema: { type: "object" } },
    },
    max_tokens: 220,
  });
  assert.equal(request.think, false);
  assert.equal(request.keep_alive, "30m");
  assert.equal(request.options.num_predict, 220);
  assert.deepEqual(request.format, { type: "object" });
});

test("expands every named language from model-approved evidence", () => {
  const evidence =
    "Kommunikationsfähigkeiten in Deutsch und Englisch.";
  const expanded = JSON.parse(
    expandNamedLanguagesFromEvidence(
      JSON.stringify({
        language: {
          status: "uncertain",
          requirements: [{ language: "English", evidence }],
        },
      }),
    ),
  );
  assert.equal(expanded.language.status, "found");
  assert.deepEqual(
    expanded.language.requirements.map(({ language }) => language),
    ["German", "English"],
  );
});

test("rejects human-language claims grounded only in programming evidence", () => {
  const evidence =
    "Experience programming with at least one modern language such as Java, C++, or C# including object-oriented design";
  const cleaned = JSON.parse(
    removeProgrammingLanguageFalsePositives(
      JSON.stringify({
        language: {
          status: "found",
          requirements: [
            { language: "Chinese", evidence },
            { language: "English", evidence },
          ],
        },
      }),
    ),
  );
  assert.deepEqual(cleaned.language, {
    status: "none",
    requirements: [],
  });
});

test("prepares and validates a reusable compact preference profile", async () => {
  const fetchImpl = async (_url, options) => {
    const request = JSON.parse(options.body);
    assert.equal(request.max_tokens, 260);
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                coreSkills: ["C#", ".NET"],
                bonusSkills: ["Blazor"],
                positivePreferences: ["English working language"],
                penalties: ["German C1 required"],
                blockers: [],
              }),
            },
          },
        ],
      }),
      { status: 200 },
    );
  };
  const criteria =
    "I would really like the role to match my professional experience with C# and .NET. Blazor would be a welcome bonus when it appears in the posting. I prefer English as the working language. Please apply a meaningful penalty when German at C1 level is an explicit requirement, but do not turn that preference into an automatic rejection.";
  const result = await prepareLocalPreferences(criteria, providerConfig, {
    fetchImpl,
  });

  assert.equal(result.optimized, true);
  assert.match(result.preparedUserCriteria, /Skills: C#; \.NET/);
  assert.equal(
    profilePreservesNamedTerms(criteria, result.preparedUserCriteria),
    true,
  );
  assert.equal(
    preferenceProfileToText({
      coreSkills: ["C#"],
      bonusSkills: [],
      positivePreferences: [],
      penalties: [],
      blockers: ["Applications closed"],
    }),
    "Skills: C#\nReject: Applications closed",
  );
});

test("falls back to raw preferences when preparation loses a named term", async () => {
  const criteria = "Match C#, .NET, and Blazor. Prefer English.";
  const result = await prepareLocalPreferences(criteria, providerConfig, {
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  coreSkills: ["C#"],
                  bonusSkills: [],
                  positivePreferences: ["English"],
                  penalties: [],
                  blockers: [],
                }),
              },
            },
          ],
        }),
        { status: 200 },
      ),
  });

  assert.equal(result.optimized, false);
  assert.equal(result.preparedUserCriteria, criteria);
});

test("expands the minimal local contract for trusted scoring", () => {
  assert.deepEqual(
    expandCompactLocalOutput({
      rubric: {
        skills: "match",
        workArrangement: "not_applicable",
        language: "conflict",
        seniority: "not_applicable",
        applicationMethod: "not_applicable",
        otherPreferences: "not_applicable",
      },
      hardBlocker: { dimension: "none", evidence: "" },
      language: {
        status: "found",
        requirements: [
          {
            language: "German",
            evidence: "Very good German skills",
          },
        ],
      },
    }),
    {
      rubric: {
        skills: { applicable: true, outcome: "match", evidence: "" },
        workArrangement: {
          applicable: false,
          outcome: "unknown",
          evidence: "",
        },
        language: {
          applicable: true,
          outcome: "conflict",
          evidence: "Very good German skills",
        },
        seniority: {
          applicable: false,
          outcome: "unknown",
          evidence: "",
        },
        applicationMethod: {
          applicable: false,
          outcome: "unknown",
          evidence: "",
        },
        otherPreferences: {
          applicable: false,
          outcome: "unknown",
          evidence: "",
        },
      },
      confidence: "low",
      hardBlockers: [],
      postingLanguage: "Unknown",
      languageRequirementStatus: "found",
      languageRequirements: [
        {
          language: "German",
          level: "stated",
          requirement: "required",
          evidence: "Very good German skills",
        },
      ],
    },
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

test("preserves language passages when compacting a long posting", () => {
  const description = [
    "A".repeat(8_000),
    "Sehr gute Deutschkenntnisse in Wort und Schrift",
    "B".repeat(8_000),
    "Good English skills are required",
    "C".repeat(8_000),
  ].join("\n\n");
  const compacted = compactLocalDescription(description);

  assert.ok(compacted.length <= LOCAL_DESCRIPTION_MAX_LENGTH);
  assert.match(compacted, /Sehr gute Deutschkenntnisse/);
  assert.match(compacted, /Good English skills/);
});

test("extracts concise translated language candidates", () => {
  assert.deepEqual(
    extractLanguageCandidateLines(
      "Build C# services\n\nVery good German skills\n\nGood English skills",
    ),
    ["Very good German skills", "Good English skills"],
  );
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
    "Potential match, led by skills. Language concern: the posting requires German.",
  );
  assert.equal(analysis.languageRequirements.length, 2);
});

test("strongly reduce does not become a language hard blocker", () => {
  const analysis = expandLocalAnalysis({
    ...modelOutput(),
    rubric: {
      ...modelOutput().rubric,
      language: { applicable: true, outcome: "partial" },
    },
    hardBlockers: [
      {
        title: "Strong German requirement",
        evidence: "Very good German skills\nGood English skills",
      },
    ],
    languageRequirementStatus: "found",
    languageRequirements: [
      {
        language: "German",
        level: "very good",
        requirement: "required",
        evidence: "Very good German skills",
      },
      {
        language: "English",
        level: "good",
        requirement: "required",
        evidence: "Good English skills",
      },
    ],
  }, {
    userCriteria:
      "Match C#. Prefer English. Strongly reduce the score when fluent German is required.",
    job: {
      description:
        "C# backend development\nVery good German skills\nGood English skills",
    },
  });

  assert.equal(analysis.rubric.language.outcome, "conflict");
  assert.equal(analysis.score, 73);
  assert.equal(analysis.hardBlockers.length, 0);
  assert.equal(
    analysis.summary,
    "Potential match, led by skills. Language concern: the posting requires German.",
  );
  assert.equal(
    userExplicitlyRejectsLanguage("Strongly reduce required German"),
    false,
  );
  assert.equal(
    userExplicitlyRejectsLanguage("Reject roles requiring German"),
    true,
  );
});

test("demotes a combined language blocker unless the user says reject", () => {
  const requirements = [
    {
      language: "German",
      level: "very good",
      requirement: "required",
      evidence: "Very good German skills",
    },
    {
      language: "English",
      level: "good",
      requirement: "required",
      evidence: "Good English skills",
    },
  ];
  assert.equal(
    blockerMatchesLanguageRequirement(
      {
        title: "Mandatory language proficiency",
        evidence: "Very good German skills\nGood English skills",
      },
      requirements,
    ),
    true,
  );
});

test("enforces a grounded strong language reduction in trusted scoring", () => {
  assert.equal(
    userStronglyReducesLanguage(
      "Strongly reduce the score when fluent German is required.",
      "German",
    ),
    true,
  );
  assert.equal(
    userStronglyReducesLanguage(
      "Strongly reduce the score when fluent German is required.",
      "English",
    ),
    false,
  );

  const analysis = expandLocalAnalysis(
    expandCompactLocalOutput({
      rubric: {
        skills: "match",
        workArrangement: "not_applicable",
        language: "unknown",
        seniority: "not_applicable",
        applicationMethod: "not_applicable",
        otherPreferences: "not_applicable",
      },
      hardBlocker: { dimension: "none", evidence: "" },
      language: {
        status: "found",
        requirements: [
          {
            language: "German",
            evidence: "Very good German skills",
          },
          {
            language: "English",
            evidence: "Good English skills",
          },
        ],
      },
    }),
    {
      userCriteria:
        "Match C#. Strongly reduce the score when fluent German is required.",
      job: {
        description:
          "C# backend development\nVery good German skills\nGood English skills",
      },
    },
  );

  assert.equal(analysis.rubric.language.outcome, "conflict");
  assert.equal(analysis.score, 73);
  assert.equal(
    analysis.summary,
    "Potential match, led by skills. Language concern: the posting requires German.",
  );
});

test("keeps the Remmert technology match above the skip band", () => {
  const analysis = expandLocalAnalysis(
    expandCompactLocalOutput({
      rubric: {
        skills: "partial",
        workArrangement: "not_applicable",
        language: "conflict",
        seniority: "not_applicable",
        applicationMethod: "not_applicable",
        otherPreferences: "not_applicable",
      },
      hardBlocker: { dimension: "none", evidence: "" },
      language: {
        status: "none",
        requirements: [
          {
            language: "German (fluent)",
            evidence: "Sehr gute Deutschkenntnisse in Wort und Schrift",
          },
          {
            language: "English",
            evidence: "Gute Englischkenntnisse",
          },
        ],
      },
    }),
    {
      userCriteria: `Match me with these skills: C#, .NET. If Blazor is present, score higher.
I do not have frontend JavaScript Framework knowledge.
Prefer positions where English is the working language or German is optional.
Strongly reduce the score when fluent German, C1, or business-level German is an explicit hard requirement.`,
      job: {
        description: `Softwareentwicklung in C# / .Net (Full Stack)
Fundierte Erfahrung in der C#-Entwicklung
Erfahrungen mit Blazor und Entity Framework Core wünschenswert
Sehr gute Deutschkenntnisse in Wort und Schrift
Gute Englischkenntnisse`,
      },
    },
  );

  assert.equal(analysis.rubric.skills.outcome, "match");
  assert.equal(analysis.rubric.language.outcome, "conflict");
  assert.equal(analysis.languageRequirements[0].language, "German");
  assert.equal(analysis.score, 73);
  assert.equal(analysis.recommendation, "consider");
  assert.equal(
    analysis.summary,
    "Potential match, led by skills. Language concern: the posting requires German.",
  );
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

test("treats an empty uncertain language scan as no explicit requirement", () => {
  const analysis = expandLocalAnalysis({
    ...modelOutput(),
    rubric: {
      ...modelOutput().rubric,
      language: { applicable: true, outcome: "unknown" },
    },
    languageRequirementStatus: "uncertain",
    languageRequirements: [],
  }, {
    userCriteria: "Prefer English; German should be optional.",
    job: {
      description:
        "Build production services with C# and collaborate across engineering teams.",
    },
  });

  assert.equal(
    analysis.summary,
    "Strong overall match, led by skills. No explicit language requirement was found in the posting.",
  );
});

test("treats ungrounded claimed language evidence as no explicit requirement", () => {
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
        level: "fluent",
        requirement: "required",
        evidence: "Fluent German is mandatory",
      },
    ],
  }, {
    userCriteria: "Prefer English; German should be optional.",
    job: {
      description:
        "Build production services with C# and collaborate across engineering teams.",
    },
  });

  assert.equal(analysis.languageRequirements.length, 0);
  assert.equal(analysis.rubric.language.outcome, "unknown");
  assert.match(
    analysis.summary,
    /No explicit language requirement was found/,
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
  assert.equal(
    result.provider.model,
    "qwen3:8b + German→English translation",
  );
  assert.equal(result.provider.responseId, "chatcmpl_local");
});

test("sends a schema-constrained request to the configured loopback server", async () => {
  let capturedRequest;
  let capturedMetrics;
  const result = await analyzeWithLocalModel(payload(), providerConfig, {
    translateImpl: async (text) => text,
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
  assert.match(result.provider.model, /German→English translation/);
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
    translateImpl: async (text) => text,
    fetchImpl: async (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        if (signal.aborted) {
          reject(new DOMException("Aborted", "AbortError"));
          return;
        }
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
