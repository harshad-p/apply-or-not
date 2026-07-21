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

function parseOpenAIResponse(response, context) {
  let modelOutput;
  try {
    modelOutput = JSON.parse(extractOutputText(response));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("OpenAI returned malformed structured analysis.");
    }
    throw error;
  }

  return normalizeAnalysis(
    modelOutput,
    {
      id: "openai",
      model: response.model || DEFAULT_MODEL,
      responseId: response.id || "",
    },
    context,
  );
}

async function readError(response) {
  const requestId = response.headers?.get?.("x-request-id") || "";
  let message = `OpenAI request failed (${response.status}).`;
  try {
    const rawBody = await response.text();
    if (rawBody) {
      try {
        const body = JSON.parse(rawBody);
        message = body?.error?.message || message;
      } catch {
        if (!/<(?:html|body|script)\b/iu.test(rawBody)) {
          message = rawBody.trim().slice(0, 300) || message;
        }
      }
    }
  } catch {
    // Keep the status-based fallback when the error body is unreadable.
  }
  return requestId ? `${message} Request ID: ${requestId}` : message;
}

function isTransientServerError(status) {
  return Number.isInteger(status) && status >= 500 && status <= 599;
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
  if (
    payload.job.application &&
    !["easy_apply", "external_apply", "unknown"].includes(
      payload.job.application.method,
    )
  ) {
    throw new Error("Extracted application method is invalid.");
  }
  if (
    payload.job.application?.status &&
    !["closed", "unknown"].includes(payload.job.application.status)
  ) {
    throw new Error("Extracted application status is invalid.");
  }
}

async function analyzeWithOpenAI(
  payload,
  {
    apiKey,
    projectId = "",
    fetchImpl = globalThis.fetch,
    timeoutMs = 60000,
    maxAttempts = 2,
  } = {},
) {
  validatePayload(payload);
  if (!apiKey) {
    throw new Error(
      "OpenAI is not configured. Enter an API key in extension settings or restart the relay with OPENAI_API_KEY.",
    );
  }
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
    const requestBody = JSON.stringify(buildOpenAIRequest(payload));
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const response = await fetchImpl(responsesUrl, {
        method: "POST",
        headers,
        body: requestBody,
        signal: controller.signal,
      });

      if (response.ok) {
        return parseOpenAIResponse(await response.json(), payload);
      }

      const errorMessage = await readError(response);
      if (isTransientServerError(response.status) && attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 500));
        continue;
      }
      throw new Error(errorMessage);
    }
    throw new Error("OpenAI analysis failed after retrying.");
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
  isTransientServerError,
  parseOpenAIResponse,
  readError,
  validatePayload,
};
