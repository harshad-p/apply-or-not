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

async function analyzeJob(payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 70000);

  try {
    const response = await fetch(`${relayUrl}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const body = await readJsonResponse(response);
    const validation = globalThis.ApplyOrNotAnalysis.validateModelOutput(
      body.analysis,
    );

    if (!validation.valid) {
      throw new Error("Local AI helper returned an invalid analysis result.");
    }

    return body.analysis;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("GPT-5.6 analysis timed out. Please try again.");
    }
    throw error;
  } finally {
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
