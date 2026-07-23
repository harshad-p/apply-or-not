"use strict";

if (typeof importScripts === "function") {
  importScripts(
    "../shared/analysis-contract.js",
    "../shared/analysis-cache.js",
    "../shared/action-badge.js",
    "../shared/analysis-runner.js",
  );
}

const extensionApi = globalThis.browser ?? globalThis.chrome;
const relayUrl = "http://127.0.0.1:8787";
const DEFAULT_LOCAL_BASE_URL = "http://127.0.0.1:11434/v1";
const updateActionBadge = globalThis.ApplyOrNotBadge.createBadgeUpdater(
  extensionApi.action,
);

async function safelyUpdateBadge(tabId, text, color) {
  try {
    await updateActionBadge(tabId, text, color);
  } catch (error) {
    console.warn("Unable to update the toolbar badge.", error);
  }
}

async function readJsonResponse(response) {
  let body = null;
  try {
    body = await response.json();
  } catch {
    throw new Error(`Local AI helper returned an unreadable response (${response.status}).`);
  }

  if (!response.ok) {
    throw new Error(body?.error || `Local AI helper failed (${response.status}).`);
  }

  return body;
}

async function checkRelay() {
  const response = await fetch(`${relayUrl}/health`);
  return readJsonResponse(response);
}

async function configureRelay(apiKey) {
  const response = await fetch(`${relayUrl}/configure`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey }),
  });
  return readJsonResponse(response);
}

async function readProviderConfig() {
  const {
    analysisProvider = "openai",
    localModel = "",
    localBaseUrl = DEFAULT_LOCAL_BASE_URL,
  } = await extensionApi.storage.local.get([
    "analysisProvider",
    "localModel",
    "localBaseUrl",
  ]);

  return analysisProvider === "local"
    ? {
        id: "local",
        model: localModel,
        baseUrl: localBaseUrl,
      }
    : { id: "openai" };
}

async function analyzeJob(payload, { signal } = {}) {
  const providerConfig = await readProviderConfig();
  const controller = new AbortController();
  const timeoutMs = providerConfig.id === "local" ? 315_000 : 70_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const cancel = () => controller.abort();
  if (signal?.aborted) {
    controller.abort();
  } else {
    signal?.addEventListener("abort", cancel, { once: true });
  }

  try {
    const response = await fetch(`${relayUrl}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload, providerConfig }),
      signal: controller.signal,
    });
    const body = await readJsonResponse(response);
    const validation = globalThis.ApplyOrNotAnalysis.validateModelOutput(
      body.analysis,
      payload,
    );

    if (!validation.valid) {
      throw new Error("Local AI helper returned an invalid analysis result.");
    }

    return body.analysis;
  } catch (error) {
    if (error?.name === "AbortError") {
      if (signal?.aborted) {
        throw new Error("Analysis canceled.");
      }
      throw new Error(
        providerConfig.id === "local"
          ? "Local model analysis timed out. Try a smaller model or shorter job description."
          : "GPT-5.6 analysis timed out. Please try again.",
      );
    }
    throw error;
  } finally {
    signal?.removeEventListener("abort", cancel);
    clearTimeout(timeout);
  }
}

const analysisRunner = globalThis.ApplyOrNotAnalysisRunner.createAnalysisRunner({
  analyze: analyzeJob,
  storage: extensionApi.storage.local,
  cacheApi: globalThis.ApplyOrNotCache,
  updateBadge: safelyUpdateBadge,
});

extensionApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  let operation;

  if (message?.type === "analysis:health") {
    operation = checkRelay();
  } else if (message?.type === "analysis:key:set") {
    operation = configureRelay(message.apiKey);
  } else if (message?.type === "analysis:run") {
    operation = analysisRunner.start(message.payload, message.context);
  } else if (message?.type === "analysis:cancel") {
    operation = analysisRunner.cancel(message.signature);
  } else if (message?.type === "analysis:status") {
    operation = analysisRunner.getStatus(message.signature);
  } else {
    return false;
  }

  operation
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});
