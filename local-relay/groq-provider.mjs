import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  buildOpenAICompatibleRequest,
  normalizeAnalysis,
} = require("../extension/shared/analysis-contract.js");

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
// Override with GROQ_MODEL env var if the default is unavailable on your account.
const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_MODEL = process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;

function extractOutputText(response) {
  const content = response?.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim()) {
    return content.trim();
  }
  throw new Error("Groq returned no analysis text.");
}

function parseGroqResponse(response, context) {
  let modelOutput;
  try {
    modelOutput = JSON.parse(extractOutputText(response));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Groq returned malformed structured analysis.");
    }
    throw error;
  }

  return normalizeAnalysis(
    modelOutput,
    {
      id: "groq",
      model: response.model || DEFAULT_GROQ_MODEL,
      responseId: response.id || "",
    },
    context,
  );
}

async function readError(response) {
  const requestId = response.headers?.get?.("x-request-id") || "";
  let message = `Groq request failed (${response.status}).`;
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
}

async function analyzeWithGroq(
  payload,
  {
    apiKey,
    model = GROQ_MODEL,
    fetchImpl = globalThis.fetch,
    timeoutMs = 60000,
    maxAttempts = 2,
  } = {},
) {
  validatePayload(payload);
  if (!apiKey) {
    throw new Error(
      "Free analysis is not available right now. Enter an OpenAI API key or use a local model.",
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

  try {
    const requestBody = JSON.stringify(buildOpenAICompatibleRequest(payload, model));
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const response = await fetchImpl(GROQ_CHAT_URL, {
        method: "POST",
        headers,
        body: requestBody,
        signal: controller.signal,
      });

      if (response.ok) {
        return parseGroqResponse(await response.json(), payload);
      }

      const errorMessage = await readError(response);
      if (isTransientServerError(response.status) && attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 500));
        continue;
      }
      throw new Error(errorMessage);
    }
    throw new Error("Groq analysis failed after retrying.");
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Groq analysis timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export {
  DEFAULT_GROQ_MODEL,
  GROQ_CHAT_URL,
  analyzeWithGroq,
  extractOutputText,
  isTransientServerError,
  parseGroqResponse,
  readError,
  validatePayload,
};
