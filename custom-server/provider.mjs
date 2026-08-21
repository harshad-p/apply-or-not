import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  buildFastLocalRequest,
  expandLocalAnalysis,
  normalizeAnalysis,
} = require("../extension/shared/analysis-contract.js");

const DEFAULT_BASE_URL = "http://127.0.0.1:11434/v1";

function getConfig() {
  const baseUrl = (process.env.CUSTOM_MODEL_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/u, "");
  const model = process.env.CUSTOM_MODEL_NAME || "";
  const apiKey = process.env.CUSTOM_MODEL_API_KEY || "";

  if (!model) {
    throw new Error(
      "CUSTOM_MODEL_NAME is not set. Set it to your model identifier (e.g. llama3.2:3b).",
    );
  }

  return { baseUrl, model, apiKey };
}

function extractOutputText(response) {
  const content = response?.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim()) {
    return content.trim();
  }
  throw new Error("Model returned no analysis text.");
}

function parseCompactResponse(response, config, payload) {
  let modelOutput;
  try {
    modelOutput = JSON.parse(extractOutputText(response));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Model returned malformed structured output.");
    }
    throw error;
  }

  // expandLocalAnalysis converts the compact rubric-only output into the
  // full normalized schema: evidence lists, summary, score, language analysis.
  const expanded = expandLocalAnalysis(modelOutput, payload);
  return normalizeAnalysis(
    expanded,
    {
      id: "custom",
      model: response.model || config.model,
      responseId: response.id || "",
    },
    payload,
  );
}

async function analyzeWithCustomModel(
  payload,
  {
    fetchImpl = globalThis.fetch,
    timeoutMs = 120_000,
  } = {},
) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Analysis payload is missing.");
  }
  if (typeof payload.userCriteria !== "string" || !payload.userCriteria.trim()) {
    throw new Error("Saved job preferences are missing.");
  }
  if (typeof payload.job?.description !== "string" || !payload.job.description.trim()) {
    throw new Error("Extracted job description is missing.");
  }
  if (typeof fetchImpl !== "function") {
    throw new Error("This Node.js version does not provide fetch.");
  }

  const config = getConfig();
  const chatUrl = `${config.baseUrl}/chat/completions`;
  const requestBody = buildFastLocalRequest(payload, config.model);

  const headers = { "Content-Type": "application/json" };
  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(chatUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!response.ok) {
      let message = `Model request failed (${response.status}).`;
      try {
        const body = await response.json();
        if (body?.error?.message) message = body.error.message;
      } catch {
        // Keep status-based message.
      }
      throw new Error(message);
    }

    return parseCompactResponse(await response.json(), config, payload);
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Model analysis timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export { analyzeWithCustomModel, DEFAULT_BASE_URL };
