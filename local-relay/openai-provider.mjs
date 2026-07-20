import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  DEFAULT_MODEL,
  buildOpenAIRequest,
  normalizeAnalysis,
} = require("../extension/shared/analysis-contract.js");

const responsesUrl = "https://api.openai.com/v1/responses";

function extractOutputText(response) {
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }

  const textParts = [];
  for (const item of response?.output || []) {
    if (item?.type !== "message") continue;
    for (const part of item.content || []) {
      if (part?.type === "refusal") {
        throw new Error(part.refusal || "The model declined this analysis.");
      }
      if (part?.type === "output_text" && typeof part.text === "string") {
        textParts.push(part.text);
      }
    }
  }

  if (!textParts.length) {
    throw new Error("OpenAI returned no structured analysis text.");
  }

  return textParts.join("");
}

function parseOpenAIResponse(response) {
  let modelOutput;
  try {
    modelOutput = JSON.parse(extractOutputText(response));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("OpenAI returned malformed structured analysis.");
    }
    throw error;
  }

  return normalizeAnalysis(modelOutput, {
    id: "openai",
    model: response.model || DEFAULT_MODEL,
    responseId: response.id || "",
  });
}

async function readError(response) {
  try {
    const body = await response.json();
    return body?.error?.message || `OpenAI request failed (${response.status}).`;
  } catch {
    return `OpenAI request failed (${response.status}).`;
  }
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Analysis payload is missing.");
  }
  if (typeof payload.userCriteria !== "string" || !payload.userCriteria.trim()) {
    throw new Error("Saved job preferences are missing.");
  }
  if (
    typeof payload.preferredLanguage !== "string" ||
    !payload.preferredLanguage.trim()
  ) {
    throw new Error("Preferred explanation language is missing.");
  }
  if (
    typeof payload.job?.description !== "string" ||
    !payload.job.description.trim()
  ) {
    throw new Error("Extracted job description is missing.");
  }
  if (payload.userCriteria.length > 8000) {
    throw new Error("Saved job preferences are too long.");
  }
  if (payload.job.description.length > 50000) {
    throw new Error("Extracted job description is too long.");
  }
}

async function analyzeWithOpenAI(
  payload,
  {
    apiKey,
    projectId = "",
    fetchImpl = globalThis.fetch,
    timeoutMs = 60000,
  } = {},
) {
  validatePayload(payload);
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
  if (typeof fetchImpl !== "function") {
    throw new Error("This Node.js version does not provide fetch.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (projectId) headers["OpenAI-Project"] = projectId;

  try {
    const response = await fetchImpl(responsesUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(buildOpenAIRequest(payload)),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(await readError(response));
    }

    return parseOpenAIResponse(await response.json());
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("OpenAI analysis timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export {
  analyzeWithOpenAI,
  extractOutputText,
  parseOpenAIResponse,
  validatePayload,
};
