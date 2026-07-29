import { createRequire } from "node:module";
import { validatePayload } from "./openai-provider.mjs";
import { validateProviderConfig } from "./configuration.mjs";

const require = createRequire(import.meta.url);
const {
  buildFastLocalRequest,
  calculateRubricScore,
  expectedRecommendation,
  normalizeAnalysis,
} = require("../extension/shared/analysis-contract.js");
const LOCAL_DESCRIPTION_MAX_LENGTH = 9_000;

function compactLocalDescription(value, maximumLength = LOCAL_DESCRIPTION_MAX_LENGTH) {
  const description = typeof value === "string" ? value.trim() : "";
  if (description.length <= maximumLength) return description;

  const omission = "\n\n[... page text omitted for local analysis ...]\n\n";
  const segmentLength = Math.floor(
    (maximumLength - omission.length * 2) / 3,
  );
  const middleStart = Math.floor((description.length - segmentLength) / 2);
  return [
    description.slice(0, segmentLength).trimEnd(),
    description
      .slice(middleStart, middleStart + segmentLength)
      .trim(),
    description.slice(-segmentLength).trimStart(),
  ].join(omission);
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

function parseLocalResponse(response, config, context) {
  let modelOutput;
  try {
    modelOutput = JSON.parse(extractLocalOutputText(response));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(
        "The local model returned malformed JSON. Choose a model that supports structured output.",
      );
    }
    throw error;
  }

  return normalizeAnalysis(
    expandLocalAnalysis(modelOutput, context),
    {
      id: "local",
      model: response.model || config.model,
      responseId: response.id || "",
    },
    context,
  );
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

function extractExplicitLanguageRequirements(description) {
  const text = typeof description === "string" ? description : "";
  const requirements = [];
  const patterns = [
    {
      language: "German",
      level: "very good written and spoken",
      expression:
        /(?:sehr\s+gute|hervorragende|ausgezeichnete|verhandlungssichere|fließende)\s+Deutschkenntnisse(?:\s+in\s+Wort\s+und\s+Schrift)?/giu,
    },
    {
      language: "German",
      level: "C1/C2 or business fluent",
      expression:
        /(?:Deutschkenntnisse[^\n.!?]{0,40}(?:C1|C2|Business[- ]Level|verhandlungssicher|fließend)|(?:C1|C2)[^\n.!?]{0,30}Deutschkenntnisse)/giu,
    },
    {
      language: "English",
      level: "good",
      expression:
        /(?:gute|sehr\s+gute|fließende|verhandlungssichere)\s+Englischkenntnisse(?:\s+in\s+Wort\s+und\s+Schrift)?/giu,
    },
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern.expression)) {
      requirements.push({
        language: pattern.language,
        level: pattern.level,
        requirement: "required",
        evidence: match[0],
      });
    }
  }
  return requirements.slice(0, 3);
}

function languageOutcomeFromEvidence(requirements, userCriteria, fallback) {
  const criteria =
    typeof userCriteria === "string" ? userCriteria.toLocaleLowerCase() : "";
  const strongGermanRequirement = requirements.some(
    (requirement) =>
      requirement.language === "German" &&
      requirement.requirement === "required" &&
      /(?:very good|c1|c2|business|fluent)/iu.test(requirement.level),
  );
  const userRejectsStrongGerman =
    /(?:strongly\s+reduce|reject|do\s+not\s+apply|hard\s+requirement|deal[- ]breaker)[^\n.]{0,100}(?:german|deutsch)|(?:german|deutsch)[^\n.]{0,100}(?:strongly\s+reduce|reject|deal[- ]breaker)/iu.test(
      criteria,
    );
  if (strongGermanRequirement && userRejectsStrongGerman) return "conflict";

  const englishRequirement = requirements.some(
    (requirement) =>
      requirement.language === "English" &&
      requirement.requirement === "required",
  );
  const userPrefersEnglish =
    /\benglish\b[^\n.]{0,80}\b(?:working\s+language|preferred|prefer|acceptable)\b|\bprefer[^\n.]{0,80}\benglish\b/iu.test(
      criteria,
    );
  if (englishRequirement && userPrefersEnglish) return "match";
  return fallback;
}

function buildLocalSummary(score, rubric, hardBlockers, context) {
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
        ["match", "partial"].includes(assessment.outcome),
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
    parts.push(`Main concern: ${negative.slice(0, 2).join(" and ")}.`);
  } else if (uncertain.length) {
    if (uncertain.length === 1 && uncertain[0] === "language") {
      parts.push("No explicit language requirement was found in the posting.");
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
  const modelLanguageRequirements = (value.languageRequirements || [])
    .filter((requirement) =>
      jobEvidence.includes(requirement.evidence.trim().toLocaleLowerCase()),
    );
  const deterministicLanguageRequirements =
    extractExplicitLanguageRequirements(context?.job?.description);
  const supportedLanguageRequirements = [
    ...deterministicLanguageRequirements,
    ...modelLanguageRequirements,
  ]
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
          supportedLanguageRequirements.length === 0
            ? "unknown"
            : dimension === "language" && explicitDimensions.language
              ? languageOutcomeFromEvidence(
                  supportedLanguageRequirements,
                  context?.userCriteria,
                  assessment.outcome,
                )
            : assessment.outcome,
      },
    ]),
  );
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
      jobEvidence.includes(blocker.evidence.trim().toLocaleLowerCase()),
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
    summary: buildLocalSummary(score, rubric, hardBlockers, context),
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
    const response = await fetchImpl(buildChatCompletionsUrl(config.baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        buildFastLocalRequest(compactedPayload, config.model),
      ),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(await readLocalError(response));
    }
    const responseBody = await response.json();
    onMetrics({
      originalDescriptionCharacters: payload.job.description.length,
      sentDescriptionCharacters: compactedPayload.job.description.length,
      promptTokens: responseBody?.usage?.prompt_tokens ?? null,
      completionTokens: responseBody?.usage?.completion_tokens ?? null,
      totalTokens: responseBody?.usage?.total_tokens ?? null,
    });
    return parseLocalResponse(responseBody, config, payload);
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
  buildChatCompletionsUrl,
  buildLocalSummary,
  compactLocalDescription,
  compactLocalPayload,
  explicitCriteriaDimensions,
  extractExplicitLanguageRequirements,
  expandLocalAnalysis,
  languageOutcomeFromEvidence,
  trustedPostingLanguage,
  extractLocalOutputText,
  parseLocalResponse,
  readLocalError,
};
