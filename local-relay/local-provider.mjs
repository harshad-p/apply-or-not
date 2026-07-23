import { createRequire } from "node:module";
import { validatePayload } from "./openai-provider.mjs";
import { validateProviderConfig } from "./configuration.mjs";

const require = createRequire(import.meta.url);
const {
  buildOpenAICompatibleRequest,
  normalizeAnalysis,
} = require("../extension/shared/analysis-contract.js");

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
    modelOutput,
    {
      id: "local",
      model: response.model || config.model,
      responseId: response.id || "",
    },
    context,
  );
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
  } = {},
) {
  validatePayload(payload);
  const config = validateProviderConfig(providerConfig);
  if (config.id !== "local") {
    throw new Error("Local model configuration is missing.");
  }
  if (typeof fetchImpl !== "function") {
    throw new Error("This Node.js version does not provide fetch.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(buildChatCompletionsUrl(config.baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        buildOpenAICompatibleRequest(payload, config.model),
      ),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(await readLocalError(response));
    }
    return parseLocalResponse(await response.json(), config, payload);
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Local model analysis timed out.");
    }
    if (error instanceof TypeError) {
      throw new Error(
        "Could not reach the local model server. Check its URL and make sure it is running.",
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export {
  analyzeWithLocalModel,
  buildChatCompletionsUrl,
  extractLocalOutputText,
  parseLocalResponse,
  readLocalError,
};
