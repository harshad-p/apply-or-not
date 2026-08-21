import { createRequire } from "node:module";
import { validatePayload } from "./openai-provider.mjs";
import { validateProviderConfig } from "./configuration.mjs";
import { translateGermanToEnglish } from "./german-translator.mjs";

const require = createRequire(import.meta.url);
const {
  buildFastLocalRequest,
  expandLocalAnalysis,
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

function usesNativeOllamaQwen(config) {
  try {
    const url = new URL(config.baseUrl);
    return (
      /^qwen3\.5:/iu.test(config.model) &&
      url.port === "11434"
    );
  } catch {
    return false;
  }
}

function buildNativeOllamaChatUrl(baseUrl) {
  const url = new URL(baseUrl);
  url.pathname = "/api/chat";
  url.search = "";
  url.hash = "";
  return url.toString();
}

function buildNativeOllamaRequest(request) {
  return {
    model: request.model,
    messages: request.messages,
    format: request.response_format.json_schema.schema,
    stream: false,
    think: false,
    keep_alive: "30m",
    options: {
      temperature: 0,
      // Keep context window small: compacted input is ~1,200–1,500 tokens.
      // 2048 is sufficient and saves ~200 MB of VRAM vs 4096 for the KV cache,
      // leaving more room for model layers to sit fully in GPU VRAM.
      num_ctx: 2048,
      num_predict: request.max_tokens,
      // Load as many model layers as possible onto the GPU.
      // 99 is a sentinel meaning "all layers"; Ollama will load up to what fits.
      // On a 4 GB VRAM card with llama3.2:3b-instruct-q4_K_M (~2.0 GB weights),
      // all layers should fit with ~2 GB to spare for activations and KV cache.
      num_gpu: 99,
    },
  };
}

const HUMAN_LANGUAGE_ALIASES = [
  ["German", /\b(?:German|Deutsch(?:kenntnisse)?)\b/iu],
  ["English", /\b(?:English|Englisch(?:kenntnisse)?)\b/iu],
  ["French", /\b(?:French|Französisch)\b/iu],
  ["Spanish", /\b(?:Spanish|Spanisch)\b/iu],
  ["Italian", /\b(?:Italian|Italienisch)\b/iu],
  ["Dutch", /\b(?:Dutch|Niederländisch)\b/iu],
  ["Portuguese", /\b(?:Portuguese|Portugiesisch)\b/iu],
  ["Japanese", /\b(?:Japanese|Japanisch)\b/iu],
  ["Chinese", /\b(?:Chinese|Chinesisch)\b/iu],
  ["Korean", /\b(?:Korean|Koreanisch)\b/iu],
  ["Polish", /\b(?:Polish|Polnisch)\b/iu],
  ["Turkish", /\b(?:Turkish|Türkisch)\b/iu],
  ["Arabic", /\b(?:Arabic|Arabisch)\b/iu],
  ["Russian", /\b(?:Russian|Russisch)\b/iu],
];

function expandNamedLanguagesFromEvidence(outputText) {
  const value = JSON.parse(outputText);
  const requirements = Array.isArray(value?.language?.requirements)
    ? value.language.requirements
    : [];
  const expanded = requirements.flatMap((requirement) => {
    const languages = HUMAN_LANGUAGE_ALIASES
      .filter(([, expression]) => expression.test(requirement.evidence || ""))
      .map(([language]) => language);
    if (languages.length === 0) return [requirement];
    return languages.map((language) => ({
      language,
      evidence: requirement.evidence,
    }));
  });
  const supported = expanded
    .filter(
      (requirement, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.language === requirement.language &&
            candidate.evidence === requirement.evidence,
        ) === index,
    )
    .slice(0, 3);
  value.language = {
    status: supported.length > 0 ? "found" : "none",
    requirements: supported,
  };
  return JSON.stringify(value);
}

function removeProgrammingLanguageFalsePositives(outputText) {
  const value = JSON.parse(outputText);
  const requirements = Array.isArray(value?.language?.requirements)
    ? value.language.requirements
    : [];
  const supported = requirements.filter(({ evidence }) => {
    const text = String(evidence || "");
    const clearlyProgramming =
      /\b(?:programming|object[- ]oriented|software development)\b/iu.test(
        text,
      ) &&
      /\b(?:Java|JavaScript|Python|SQL|C#|C\+\+)\b/iu.test(text);
    const namesHumanLanguage =
      /\b(?:German|Deutsch|English|Englisch|French|Französisch|Spanish|Spanisch|Italian|Italienisch|Dutch|Niederländisch|Portuguese|Portugiesisch|Japanese|Japanisch|Chinese|Chinesisch|Korean|Koreanisch|Polish|Polnisch|Turkish|Türkisch|Arabic|Arabisch|Russian|Russisch)\b/iu.test(
        text,
      );
    return !clearlyProgramming || namesHumanLanguage;
  });
  if (supported.length === requirements.length) return outputText;
  value.language = {
    status: supported.length > 0 ? "found" : "none",
    requirements: supported,
  };
  return JSON.stringify(value);
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
  const request = buildPreferencePreparationRequest(criteria, config.model);
  const nativeOllamaQwen = usesNativeOllamaQwen(config);
  // Preference text is short; 512 tokens of context is more than enough.
  // Inject GPU and context hints for the OpenAI-compat path the same way
  // the analysis request does.
  const openAiCompatPrepRequest = {
    ...request,
    num_gpu: 99,
    num_ctx: 512,
  };
  const response = await fetchImpl(
    nativeOllamaQwen
      ? buildNativeOllamaChatUrl(config.baseUrl)
      : buildChatCompletionsUrl(config.baseUrl),
    {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      nativeOllamaQwen
        ? buildNativeOllamaRequest(request)
        : openAiCompatPrepRequest,
    ),
    signal,
    },
  );
  if (!response.ok) throw new Error(await readLocalError(response));
  const body = await response.json();
  const profile = JSON.parse(
    nativeOllamaQwen
      ? body?.message?.content || ""
      : extractLocalOutputText(body),
  );
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
      language: requirement.language.replace(/\s*\([^)]*\)\s*$/u, "").trim(),
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
    languageRequirementStatus:
      languageRequirements.length > 0 ? "found" : value.language.status,
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
    const nativeOllamaQwen = usesNativeOllamaQwen(config);
    if (nativeOllamaQwen) {
      translatedDescription = compactLocalDescription(
        compactedPayload.job.description,
      );
    } else {
      try {
        translatedDescription = compactLocalDescription(
          await translateImpl(compactedPayload.job.description),
        );
      } catch (error) {
        throw new Error(`German translation failed: ${error.message}`);
      }
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
    const fastRequest = buildFastLocalRequest(analysisPayload, config.model);
    // For the OpenAI-compat path (non-Qwen), Ollama accepts Ollama-specific
    // options alongside standard OpenAI fields. Inject GPU and context settings
    // here so analysis-contract.js stays free of Ollama-specific concerns.
    const openAiCompatRequest = {
      ...fastRequest,
      num_gpu: 99,
      num_ctx: 2048,
    };
    const response = await fetchImpl(
      nativeOllamaQwen
        ? buildNativeOllamaChatUrl(config.baseUrl)
        : buildChatCompletionsUrl(config.baseUrl),
      {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        nativeOllamaQwen
          ? buildNativeOllamaRequest(fastRequest)
          : openAiCompatRequest,
      ),
      signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new Error(await readLocalError(response));
    }
    const providerResponse = await response.json();
    if (nativeOllamaQwen) {
      providerResponse.message.content =
        removeProgrammingLanguageFalsePositives(
          providerResponse?.message?.content || "",
        );
      providerResponse.message.content =
        expandNamedLanguagesFromEvidence(
          providerResponse?.message?.content || "",
        );
    }
    const responseBody = nativeOllamaQwen
      ? {
          id: "",
          model: providerResponse.model || config.model,
          choices: [
            {
              message: {
                content: providerResponse?.message?.content || "",
              },
            },
          ],
          usage: {
            prompt_tokens: providerResponse.prompt_eval_count || null,
            completion_tokens: providerResponse.eval_count || null,
            total_tokens:
              (providerResponse.prompt_eval_count || 0) +
                (providerResponse.eval_count || 0) || null,
          },
        }
      : providerResponse;
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
  buildNativeOllamaChatUrl,
  buildNativeOllamaRequest,
  buildChatCompletionsUrl,
  compactLocalDescription,
  compactLocalPayload,
  extractLanguageCandidateLines,
  expandCompactLocalOutput,
  extractLocalOutputText,
  parseLocalResponse,
  parseLanguageExtractionResponse,
  prepareLocalPreferences,
  buildPreferencePreparationRequest,
  preferenceProfileToText,
  profilePreservesNamedTerms,
  readLocalError,
  usesNativeOllamaQwen,
  expandNamedLanguagesFromEvidence,
  removeProgrammingLanguageFalsePositives,
};
