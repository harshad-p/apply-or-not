import { createRequire } from "node:module";
import { validatePayload } from "./openai-provider.mjs";
import { validateProviderConfig } from "./configuration.mjs";
import { translateGermanToEnglish } from "./german-translator.mjs";

const require = createRequire(import.meta.url);
const {
  buildFastLocalRequest,
  calculateRubricScore,
  expectedRecommendation,
  normalizeAnalysis,
} = require("../extension/shared/analysis-contract.js");
const LOCAL_DESCRIPTION_MAX_LENGTH = 9_000;
const LANGUAGE_PASSAGE_PATTERN =
  /deutsch|englisch|sprach|\b(?:german|english|language|languages)\b/iu;

function findLanguagePassages(description, maximumLength) {
  const passages = extractLanguageCandidateLines(description);
  return passages.join("\n").slice(0, maximumLength);
}

function extractLanguageCandidateLines(description) {
  return [
    ...new Set(
      description
    .split(/\n{2,}|\n/u)
    .map((passage) => passage.trim())
    .filter(
      (passage) =>
        passage.length >= 3 && LANGUAGE_PASSAGE_PATTERN.test(passage),
    ),
    ),
  ].slice(0, 8);
}

function compactLocalDescription(value, maximumLength = LOCAL_DESCRIPTION_MAX_LENGTH) {
  const description = typeof value === "string" ? value.trim() : "";
  if (description.length <= maximumLength) return description;

  const omission = "\n\n[... page text omitted for local analysis ...]\n\n";
  const priorityLabel = "\n\n[Language-related passage preserved]\n";
  const priorityMaximum = Math.floor(maximumLength * 0.2);
  const priorityPassages = findLanguagePassages(
    description,
    priorityMaximum,
  );
  const reservedLength = priorityPassages
    ? priorityLabel.length + priorityPassages.length
    : 0;
  const segmentLength = Math.floor(
    (maximumLength - omission.length * 2 - reservedLength) / 3,
  );
  const middleStart = Math.floor((description.length - segmentLength) / 2);
  const compacted = [
    description.slice(0, segmentLength).trimEnd(),
    description
      .slice(middleStart, middleStart + segmentLength)
      .trim(),
    description.slice(-segmentLength).trimStart(),
  ].join(omission);
  return priorityPassages
    ? `${compacted}${priorityLabel}${priorityPassages}`
    : compacted;
}

function compactLocalPayload(payload) {
  const originalDescription = payload?.job?.description;
  const description = compactLocalDescription(originalDescription);
  return {
    ...payload,
    job: {
      ...payload.job,
      description,
    },
  };
}

function buildChatCompletionsUrl(baseUrl) {
  return `${baseUrl.replace(/\/+$/u, "")}/chat/completions`;
}

const preferenceProfileSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    coreSkills: { type: "array", maxItems: 20, items: { type: "string" } },
    bonusSkills: { type: "array", maxItems: 12, items: { type: "string" } },
    positivePreferences: {
      type: "array",
      maxItems: 12,
      items: { type: "string" },
    },
    penalties: { type: "array", maxItems: 12, items: { type: "string" } },
    blockers: { type: "array", maxItems: 8, items: { type: "string" } },
  },
  required: [
    "coreSkills",
    "bonusSkills",
    "positivePreferences",
    "penalties",
    "blockers",
  ],
};

function buildPreferencePreparationRequest(userCriteria, model) {
  return {
    model,
    messages: [
      {
        role: "system",
        content:
          "Compress job preferences without changing their meaning. Preserve every named skill, language, proficiency level, condition, exception, strength of preference, penalty, and rejection rule. Do not promote a preference or penalty into a blocker. Use concise phrases and return only the schema fields.",
      },
      {
        role: "user",
        content: userCriteria,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "job_preference_profile",
        strict: true,
        schema: preferenceProfileSchema,
      },
    },
    reasoning_effort: "none",
    temperature: 0,
    max_tokens: 260,
    stream: false,
  };
}

function preferenceProfileToText(profile) {
  const labels = {
    coreSkills: "Skills",
    bonusSkills: "Boosts",
    positivePreferences: "Prefer",
    penalties: "Penalize",
    blockers: "Reject",
  };
  return Object.entries(labels)
    .map(([field, label]) => {
      const values = Array.isArray(profile?.[field])
        ? profile[field].map((value) => String(value).trim()).filter(Boolean)
        : [];
      return values.length ? `${label}: ${values.join("; ")}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

function profilePreservesNamedTerms(userCriteria, preparedUserCriteria) {
  const importantTerms = String(userCriteria || "").match(
    /(?:c#|\.net(?:\s+core)?|asp\.net(?:\s+core)?|blazor|react|angular|vue|sql(?:\s+server)?|postgresql|azure|aws|gcp|kubernetes|docker|english|german|deutsch|englisch|[abc][12])/giu,
  ) || [];
  const normalizedProfile = String(preparedUserCriteria || "").toLocaleLowerCase();
  return [...new Set(importantTerms.map((term) => term.toLocaleLowerCase()))]
    .every((term) => normalizedProfile.includes(term));
}

async function prepareLocalPreferences(
  userCriteria,
  providerConfig,
  { fetchImpl = globalThis.fetch, signal } = {},
) {
  const criteria = String(userCriteria || "").trim();
  if (!criteria) throw new Error("Preferences are required.");
  const config = validateProviderConfig(providerConfig);
  const response = await fetchImpl(buildChatCompletionsUrl(config.baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      buildPreferencePreparationRequest(criteria, config.model),
    ),
    signal,
  });
  if (!response.ok) throw new Error(await readLocalError(response));
  const body = await response.json();
  const profile = JSON.parse(extractLocalOutputText(body));
  const preparedUserCriteria = preferenceProfileToText(profile);
  if (
    !preparedUserCriteria ||
    !profilePreservesNamedTerms(criteria, preparedUserCriteria)
  ) {
    return {
      preparedUserCriteria: criteria,
      optimized: false,
      warning:
        "The compact profile did not preserve every named term, so the original preferences will be used.",
    };
  }
  return {
    preparedUserCriteria:
      preparedUserCriteria.length < criteria.length
        ? preparedUserCriteria
        : criteria,
    optimized: preparedUserCriteria.length < criteria.length,
    warning:
      preparedUserCriteria.length < criteria.length
        ? ""
        : "The compact profile was not shorter, so the original preferences will be used.",
  };
}

function extractLocalOutputText(response) {
  const content = response?.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim()) return content;

  if (Array.isArray(content)) {
    const text = content
      .filter((part) => part?.type === "text" && typeof part.text === "string")
      .map((part) => part.text)
      .join("");
    if (text.trim()) return text;
  }

  throw new Error("The local model returned no structured analysis text.");
}

function expandCompactLocalOutput(value) {
  if (
    !value?.rubric ||
    typeof value.rubric.skills !== "string" ||
    !value?.language ||
    !value?.hardBlocker
  ) {
    return value;
  }

  const languageRequirements = (value.language.requirements || []).map(
    (requirement) => ({
      language: requirement.language,
      level: "stated",
      requirement: "required",
      evidence: requirement.evidence,
    }),
  );
  const languageEvidence = languageRequirements[0]?.evidence || "";
  const hardBlocker =
    value.hardBlocker.dimension === "none"
      ? []
      : [
          {
            title: `${value.hardBlocker.dimension} blocker`,
            evidence: value.hardBlocker.evidence,
          },
        ];
  return {
    rubric: Object.fromEntries(
      Object.entries(value.rubric).map(([dimension, outcome]) => [
        dimension,
        {
          applicable: outcome !== "not_applicable",
          outcome: outcome === "not_applicable" ? "unknown" : outcome,
          evidence:
            dimension === "language" ? languageEvidence : "",
        },
      ]),
    ),
    confidence: "low",
    hardBlockers: hardBlocker,
    postingLanguage: "Unknown",
    languageRequirementStatus: value.language.status,
    languageRequirements,
  };
}

function parseLocalResponse(response, config, context, languageEvidence) {
  let modelOutput;
  try {
    modelOutput = expandCompactLocalOutput(
      JSON.parse(extractLocalOutputText(response)),
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(
        "The local model returned malformed JSON. Choose a model that supports structured output.",
      );
    }
    throw error;
  }

  if (languageEvidence) {
    modelOutput.languageRequirementStatus = languageEvidence.status;
    modelOutput.languageRequirements = languageEvidence.requirements;
    modelOutput.postingLanguage =
      languageEvidence.postingLanguage || modelOutput.postingLanguage;
    modelOutput.rubric.language = {
      applicable: true,
      outcome: languageEvidence.outcome,
      evidence:
        languageEvidence.requirements[0]?.evidence ||
        modelOutput.rubric.language?.evidence ||
        "",
    };
  }

  return normalizeAnalysis(
    expandLocalAnalysis(modelOutput, context),
    {
      id: "local",
      model: `${response.model || config.model} + German→English translation`,
      responseId: response.id || "",
    },
    context,
  );
}

function parseLanguageExtractionResponse(response) {
  const value = JSON.parse(extractLocalOutputText(response));
  if (
    !["found", "none", "uncertain"].includes(value?.status) ||
    typeof value?.postingLanguage !== "string" ||
    !["match", "partial", "unknown", "gap", "conflict"].includes(
      value?.outcome,
    ) ||
    !Array.isArray(value?.requirements)
  ) {
    throw new Error("The language extraction model returned an invalid result.");
  }
  if (value.status === "found" && value.requirements.length === 0) {
    return { ...value, status: "uncertain" };
  }
  if (value.requirements.length > 0) {
    const outcomePriority = [
      "conflict",
      "gap",
      "unknown",
      "partial",
      "match",
    ];
    const itemOutcomes = value.requirements
      .map((requirement) => requirement.fit)
      .filter((fit) => outcomePriority.includes(fit));
    const outcome = itemOutcomes.length
      ? outcomePriority.find((candidate) => itemOutcomes.includes(candidate))
      : value.outcome;
    const requirements = value.requirements.map(({ fit, ...requirement }) =>
      requirement
    );
    return { ...value, status: "found", outcome, requirements };
  }
  return value;
}

const DIMENSION_LABELS = {
  skills: "Skills",
  workArrangement: "Work arrangement",
  language: "Language",
  seniority: "Seniority",
  applicationMethod: "Application method",
  otherPreferences: "Other preferences",
};

const DIMENSION_SUBJECTS = {
  skills: "skills",
  workArrangement: "work-arrangement",
  language: "language",
  seniority: "seniority",
  applicationMethod: "application-method",
  otherPreferences: "other",
};

function evidenceItem(dimension, assessment) {
  const label = DIMENSION_LABELS[dimension] || dimension;
  const subject =
    DIMENSION_SUBJECTS[dimension] || label.toLocaleLowerCase();
  const explanations = {
    match: `The posting supports your stated ${subject} preference.`,
    partial: `The posting partly supports your stated ${subject} preference.`,
    unknown: `The posting does not provide enough evidence about your ${subject} preference.`,
    gap: `The posting does not fully meet your stated ${subject} preference.`,
    conflict: `The posting conflicts with your stated ${subject} preference.`,
  };
  return {
    title: `${label}: ${assessment.outcome}`,
    explanation: explanations[assessment.outcome],
    evidence: assessment.evidence || "No explicit evidence found",
  };
}

function explicitCriteriaDimensions(userCriteria) {
  const text = typeof userCriteria === "string" ? userCriteria : "";
  const applicationMethodMentioned =
    /\b(?:easy\s+apply|application\s+method|one[- ]click\s+apply)\b/iu.test(
      text,
    ) &&
    !/\beasy\s+apply\b.{0,60}\bnot\s+(?:required|mandatory)\b/isu.test(
      text,
    );
  return {
    workArrangement:
      /\b(?:remote|hybrid|on[- ]?site|onsite|in[- ]office|work(?:ing)?\s+from\s+home|office[- ]based)\b/iu.test(
        text,
      ),
    language:
      /\b(?:language|english|german|japanese|french|spanish|fluent|fluency|business[- ]level|[abc][12])\b/iu.test(
        text,
      ),
    seniority:
      /\b(?:junior|mid[- ]?level|senior|lead|principal|staff|entry[- ]level|years?\s+(?:of\s+)?experience)\b/iu.test(
        text,
      ),
    applicationMethod: applicationMethodMentioned,
    otherPreferences:
      /\b(?:compan(?:y|ies)|employer|industry|domain|sector|salary|compensation|visa|sponsorship|relocation|location|country|city|travel|benefits?|contract|full[- ]time|part[- ]time)\b/iu.test(
        text,
      ),
  };
}

function countMatches(text, expression) {
  return text.match(expression)?.length || 0;
}

function trustedPostingLanguage(description, modelLanguage) {
  const text = typeof description === "string" ? description : "";
  const englishSignals = countMatches(
    text,
    /\b(?:the|and|with|experience|job|team|will|requirements?|skills?)\b/giu,
  );
  const germanSignals = countMatches(
    text,
    /\b(?:und|der|die|das|mit|erfahrung|kenntnisse|anforderungen|deutsch|wir|sie)\b/giu,
  );
  if (englishSignals >= 8 && englishSignals > germanSignals * 2) {
    return "English";
  }
  if (germanSignals >= 8 && germanSignals > englishSignals * 2) {
    return "German";
  }
  return modelLanguage;
}

function normalizeEvidence(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/^[\s"'“”‘’*•–—-]+|[\s"'“”‘’*•–—-]+$/gu, "")
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase();
}

function evidenceAppearsInJob(evidence, jobEvidence) {
  const normalizedEvidence = normalizeEvidence(evidence);
  const normalizedJob = normalizeEvidence(jobEvidence);
  return (
    normalizedEvidence.length >= 3 &&
    normalizedJob.includes(normalizedEvidence)
  );
}

function userExplicitlyRejectsLanguage(userCriteria) {
  return /\b(?:reject|skip|never apply|do not apply|hard blocker|deal[- ]breaker|must not apply)\b/iu.test(
    userCriteria || "",
  );
}

function userStronglyReducesLanguage(userCriteria, language) {
  const normalizedCriteria = String(userCriteria || "").toLocaleLowerCase();
  const normalizedLanguage = String(language || "").toLocaleLowerCase();
  if (!normalizedLanguage) return false;
  return normalizedCriteria
    .split(/[\n.!?]+/u)
    .some(
      (statement) =>
        /(?:strongly\s+(?:reduce|penalize)|strong\s+penalty)/iu.test(
          statement,
        ) && statement.includes(normalizedLanguage),
    );
}

function extractExplicitCoreSkills(userCriteria) {
  const match = String(userCriteria || "").match(
    /\bmatch\s+me\s+with\s+(?:these\s+)?skills\s*:\s*([^\n.]+)/iu,
  );
  if (!match) return [];
  return match[1]
    .split(/[,;/]|\band\b/iu)
    .map((skill) => skill.trim())
    .filter((skill) => skill.length >= 2 && skill.length <= 40)
    .slice(0, 12);
}

function jobContainsSkill(jobEvidence, skill) {
  const normalizedJob = normalizeEvidence(jobEvidence);
  const normalizedSkill = normalizeEvidence(skill);
  if (!normalizedSkill) return false;
  if (normalizedSkill === ".net") {
    return /(?:^|[^a-z0-9])\.?net(?:\s+core)?(?:$|[^a-z0-9])/iu.test(
      normalizedJob,
    );
  }
  if (normalizedSkill === "c#") {
    return /(?:^|[^a-z0-9])c#(?:$|[^a-z0-9])/iu.test(normalizedJob);
  }
  return normalizedJob.includes(normalizedSkill);
}

function blockerMatchesLanguageRequirement(blocker, requirements) {
  const blockerText = normalizeEvidence(
    `${blocker?.title || ""} ${blocker?.evidence || ""}`,
  );
  const blockerEvidence = normalizeEvidence(blocker?.evidence);
  return requirements.some((requirement) => {
    const requirementEvidence = normalizeEvidence(requirement.evidence);
    const language = normalizeEvidence(requirement.language);
    return (
      blockerEvidence.includes(requirementEvidence) ||
      requirementEvidence.includes(blockerEvidence) ||
      (language.length >= 3 && blockerText.includes(language))
    );
  });
}

function buildLocalSummary(
  score,
  rubric,
  hardBlockers,
  context,
  languageRequirementStatus = "uncertain",
  languageRequirements = [],
) {
  if (context?.job?.application?.status === "closed") {
    return "Applications are closed for this role, regardless of the underlying job fit.";
  }
  if (hardBlockers.length) {
    return "This role conflicts with an explicit deal-breaker in your preferences.";
  }

  const matching = Object.entries(rubric)
    .filter(
      ([, assessment]) =>
        assessment.applicable &&
        assessment.outcome === "match",
    )
    .map(([dimension]) => DIMENSION_LABELS[dimension].toLocaleLowerCase());
  const uncertain = Object.entries(rubric)
    .filter(
      ([, assessment]) =>
        assessment.applicable && assessment.outcome === "unknown",
    )
    .map(([dimension]) => DIMENSION_LABELS[dimension].toLocaleLowerCase());
  const negative = Object.entries(rubric)
    .filter(
      ([, assessment]) =>
        assessment.applicable &&
        ["gap", "conflict"].includes(assessment.outcome),
    )
    .map(([dimension]) => DIMENSION_LABELS[dimension].toLocaleLowerCase());

  const lead =
    score >= 80
      ? "Strong overall match"
      : score >= 60
        ? "Potential match"
        : "Weak overall match";
  const parts = [
    matching.length
      ? `${lead}, led by ${matching.slice(0, 2).join(" and ")}.`
      : `${lead} based on the available evidence.`,
  ];
  if (negative.length) {
    if (negative.includes("language") && languageRequirements.length) {
      const conflictingRequirements = languageRequirements.filter(
        ({ language }) =>
          userStronglyReducesLanguage(context?.userCriteria, language),
      );
      const requirements = (
        conflictingRequirements.length
          ? conflictingRequirements
          : languageRequirements
      )
        .map(({ language }) => language)
        .slice(0, 3);
      const formatted =
        requirements.length > 1
          ? `${requirements.slice(0, -1).join(", ")} and ${requirements.at(-1)}`
          : requirements[0];
      parts.push(`Language concern: the posting requires ${formatted}.`);
    } else {
      parts.push(`Main concern: ${negative.slice(0, 2).join(" and ")}.`);
    }
  } else if (uncertain.length) {
    if (uncertain.length === 1 && uncertain[0] === "language") {
      parts.push(
        languageRequirementStatus === "none"
          ? "No explicit language requirement was found in the posting."
          : "The local model could not confidently determine the language requirements.",
      );
    } else {
      parts.push(
        `The posting does not clearly confirm your ${uncertain
          .slice(0, 2)
          .join(" and ")} preference.`,
      );
    }
  }
  return parts.join(" ");
}

function expandLocalAnalysis(value, context) {
  const explicitDimensions = explicitCriteriaDimensions(context?.userCriteria);
  const jobEvidence = [
    context?.job?.title,
    context?.job?.company,
    context?.job?.companyContext,
    context?.job?.description,
    context?.job?.application?.label,
    context?.job?.application?.statusLabel,
  ]
    .filter(Boolean)
    .join("\n")
    .toLocaleLowerCase();
  const supportedLanguageRequirements = (value.languageRequirements || [])
    .filter((requirement) =>
      evidenceAppearsInJob(requirement.evidence, jobEvidence),
    )
    .filter(
      (requirement, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.language === requirement.language &&
            candidate.evidence.toLocaleLowerCase() ===
              requirement.evidence.toLocaleLowerCase(),
        ) === index,
    )
    .slice(0, 3);
  const languageRequirementStatus =
    value.languageRequirementStatus === "found" &&
    supportedLanguageRequirements.length === 0
      ? "none"
      : value.languageRequirementStatus === "uncertain" &&
          (value.languageRequirements || []).length === 0
        ? "none"
        : value.languageRequirementStatus;
  const rubric = Object.fromEntries(
    Object.entries(value.rubric || {}).map(([dimension, assessment]) => [
      dimension,
      {
        applicable:
          Object.hasOwn(explicitDimensions, dimension)
            ? explicitDimensions[dimension]
            : assessment.applicable,
        outcome:
          dimension === "language" &&
          explicitDimensions.language &&
          languageRequirementStatus !== "found"
            ? "unknown"
            : assessment.outcome,
      },
    ]),
  );
  const demotedLanguageBlocker = (value.hardBlockers || []).some(
    (blocker) =>
      blockerMatchesLanguageRequirement(
        blocker,
        supportedLanguageRequirements,
      ) &&
      !userExplicitlyRejectsLanguage(context?.userCriteria),
  );
  if (demotedLanguageBlocker && rubric.language?.applicable) {
    rubric.language.outcome = "conflict";
  }
  const groundedStrongReduction = supportedLanguageRequirements.some(
    (requirement) =>
      userStronglyReducesLanguage(
        context?.userCriteria,
        requirement.language,
      ),
  );
  if (groundedStrongReduction && rubric.language?.applicable) {
    rubric.language.outcome = "conflict";
  }
  const explicitCoreSkills = extractExplicitCoreSkills(context?.userCriteria);
  if (
    explicitCoreSkills.length > 0 &&
    explicitCoreSkills.every((skill) => jobContainsSkill(jobEvidence, skill)) &&
    rubric.skills?.applicable &&
    ["partial", "unknown"].includes(rubric.skills.outcome)
  ) {
    rubric.skills.outcome = "match";
  }
  const applicable = Object.entries(value.rubric || {})
    .map(([dimension, assessment]) => [
      dimension,
      {
        ...assessment,
        applicable: rubric[dimension]?.applicable,
        outcome: rubric[dimension]?.outcome,
      },
    ])
    .filter(([, assessment]) => assessment.applicable);
  const positiveMatches = applicable
    .filter(([, assessment]) =>
      ["match", "partial"].includes(assessment.outcome),
    )
    .map(([dimension, assessment]) => evidenceItem(dimension, assessment))
    .slice(0, 3);
  const concerns = applicable
    .filter(([, assessment]) =>
      ["unknown", "gap", "conflict"].includes(assessment.outcome),
    )
    .map(([dimension, assessment]) => evidenceItem(dimension, assessment))
    .slice(0, 3);
  const hardBlockers = (value.hardBlockers || [])
    .filter((blocker) =>
      evidenceAppearsInJob(blocker.evidence, jobEvidence),
    )
    .filter(
      (blocker) =>
        !blockerMatchesLanguageRequirement(
          blocker,
          supportedLanguageRequirements,
        ) ||
        userExplicitlyRejectsLanguage(context?.userCriteria),
    )
    .map((blocker) => ({
      title: blocker.title,
      explanation:
        "This conflicts with an explicit deal-breaker or prevents an application.",
      evidence: blocker.evidence,
    }));
  const draft = {
    score: 0,
    recommendation: "skip",
    rubric,
    confidence:
      value.confidence === "high" &&
      Object.values(rubric).some(
        (assessment) =>
          assessment.applicable && assessment.outcome === "unknown",
      )
        ? "medium"
        : value.confidence,
    summary: "Local analysis completed.",
    positiveMatches,
    concerns,
    hardBlockers,
    uncertainties: concerns
      .filter((item) => item.title.endsWith(": unknown"))
      .map((item) => item.title.replace(": unknown", "")),
    postingLanguage: trustedPostingLanguage(
      context?.job?.description,
      value.postingLanguage,
    ),
    languageRequirements: supportedLanguageRequirements,
  };
  const score = calculateRubricScore(draft, context);
  return {
    ...draft,
    score,
    recommendation: expectedRecommendation(score),
    summary: buildLocalSummary(
      score,
      rubric,
      hardBlockers,
      context,
      languageRequirementStatus,
      supportedLanguageRequirements,
    ),
  };
}

async function readLocalError(response) {
  let message = `Local model request failed (${response.status}).`;
  try {
    const rawBody = await response.text();
    if (!rawBody) return message;
    try {
      const body = JSON.parse(rawBody);
      message =
        body?.error?.message ||
        (typeof body?.error === "string" ? body.error : "") ||
        message;
    } catch {
      if (!/<(?:html|body|script)\b/iu.test(rawBody)) {
        message = rawBody.trim().slice(0, 300) || message;
      }
    }
  } catch {
    // Keep the status-based fallback when the response cannot be read.
  }
  return message;
}

async function analyzeWithLocalModel(
  payload,
  providerConfig,
  {
    fetchImpl = globalThis.fetch,
    timeoutMs = 300_000,
    signal,
    onMetrics = () => {},
    translateImpl = translateGermanToEnglish,
  } = {},
) {
  validatePayload(payload);
  const config = validateProviderConfig(providerConfig);
  const compactedPayload = compactLocalPayload(payload);
  if (config.id !== "local") {
    throw new Error("Local model configuration is missing.");
  }
  if (typeof fetchImpl !== "function") {
    throw new Error("This Node.js version does not provide fetch.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const cancel = () => controller.abort();
  if (signal?.aborted) {
    controller.abort();
  } else {
    signal?.addEventListener("abort", cancel, { once: true });
  }

  try {
    const translationStartedAt = performance.now();
    let translatedDescription;
    try {
      translatedDescription = compactLocalDescription(
        await translateImpl(compactedPayload.job.description),
      );
    } catch (error) {
      throw new Error(`German translation failed: ${error.message}`);
    }
    const translationDurationMs = performance.now() - translationStartedAt;
    const analysisPayload = {
      ...compactedPayload,
      job: {
        ...compactedPayload.job,
        description: translatedDescription,
        languageCandidates:
          extractLanguageCandidateLines(translatedDescription),
      },
    };
    const response = await fetchImpl(buildChatCompletionsUrl(config.baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        buildFastLocalRequest(analysisPayload, config.model),
      ),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(await readLocalError(response));
    }
    const responseBody = await response.json();
    onMetrics({
      originalDescriptionCharacters: payload.job.description.length,
      sentDescriptionCharacters: translatedDescription.length,
      translationDurationMs,
      promptTokens: responseBody?.usage?.prompt_tokens || null,
      completionTokens: responseBody?.usage?.completion_tokens || null,
      totalTokens: responseBody?.usage?.total_tokens || null,
    });
    return parseLocalResponse(
      responseBody,
      config,
      analysisPayload,
      null,
    );
  } catch (error) {
    if (error?.name === "AbortError") {
      if (signal?.aborted) {
        throw new Error("Local model analysis canceled.");
      }
      throw new Error("Local model analysis timed out.");
    }
    if (error instanceof TypeError) {
      throw new Error(
        "Could not reach the local model server. Check its URL and make sure it is running.",
      );
    }
    throw error;
  } finally {
    signal?.removeEventListener("abort", cancel);
    clearTimeout(timeout);
  }
}

export {
  LOCAL_DESCRIPTION_MAX_LENGTH,
  analyzeWithLocalModel,
  blockerMatchesLanguageRequirement,
  buildChatCompletionsUrl,
  buildLocalSummary,
  compactLocalDescription,
  compactLocalPayload,
  explicitCriteriaDimensions,
  evidenceAppearsInJob,
  extractExplicitCoreSkills,
  extractLanguageCandidateLines,
  expandCompactLocalOutput,
  expandLocalAnalysis,
  jobContainsSkill,
  trustedPostingLanguage,
  extractLocalOutputText,
  parseLocalResponse,
  parseLanguageExtractionResponse,
  prepareLocalPreferences,
  buildPreferencePreparationRequest,
  preferenceProfileToText,
  profilePreservesNamedTerms,
  readLocalError,
  userExplicitlyRejectsLanguage,
  userStronglyReducesLanguage,
};
