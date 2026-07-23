import { createRequire } from "node:module";
import { validatePayload } from "./openai-provider.mjs";
import { validateProviderConfig } from "./configuration.mjs";

const require = createRequire(import.meta.url);
const {
  buildOpenAICompatibleRequest,
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
        buildOpenAICompatibleRequest(compactedPayload, config.model),
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
  compactLocalDescription,
  compactLocalPayload,
  extractLocalOutputText,
  parseLocalResponse,
  readLocalError,
};
