"use strict";

importScripts("../shared/analysis-contract.js");

const extensionApi = globalThis.browser ?? globalThis.chrome;
const relayUrl = "http://127.0.0.1:8787";

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

extensionApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  let operation;

  if (message?.type === "analysis:health") {
    operation = checkRelay();
  } else if (message?.type === "analysis:run") {
    operation = analyzeJob(message.payload);
  } else {
    return false;
  }

  operation
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});
