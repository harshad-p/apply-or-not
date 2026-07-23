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

function waitForPoll(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, milliseconds);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

async function analyzeWithRelayJob(payload, providerConfig, requestId, signal) {
  const startResponse = await fetch(`${relayUrl}/analyze/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload, providerConfig, requestId }),
    signal,
  });
  await readJsonResponse(startResponse);

  while (true) {
    await waitForPoll(1000, signal);
    const statusResponse = await fetch(
      `${relayUrl}/analyze/status?requestId=${encodeURIComponent(requestId)}`,
      { signal },
    );
    const status = await readJsonResponse(statusResponse);
    if (status.state === "completed") {
      return status.analysis;
    }
    if (status.state === "error") {
      throw new Error(status.error || "Local model analysis failed.");
    }
    if (status.state === "canceled") {
      throw new Error("Analysis canceled.");
    }
    if (status.state === "missing") {
      throw new Error("The local relay lost the analysis job. Please try again.");
    }
  }
}

async function analyzeJob(payload, { context, signal } = {}) {
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
    if (providerConfig.id === "local") {
      const analysis = await analyzeWithRelayJob(
        payload,
        providerConfig,
        context?.signature || "",
        controller.signal,
      );
      const validation = globalThis.ApplyOrNotAnalysis.validateModelOutput(
        analysis,
        payload,
      );
      if (!validation.valid) {
        throw new Error("Local AI helper returned an invalid analysis result.");
      }
      return analysis;
    }

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

async function cancelAnalysis(signature) {
  const relayCancellation = fetch(`${relayUrl}/analyze/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId: signature }),
  }).then((response) => readJsonResponse(response));
  const runnerCancellation = analysisRunner.cancel(signature);
  const [relayResult, runnerResult] = await Promise.allSettled([
    relayCancellation,
    runnerCancellation,
  ]);

  if (runnerResult.status === "rejected") {
    throw runnerResult.reason;
  }
  if (relayResult.status === "rejected") {
    console.warn("The relay could not confirm local-model cancellation.", relayResult.reason);
  }
  return runnerResult.value;
}

async function recoverAnalysis(signature, status) {
  if (status?.providerId !== "local") return null;

  try {
    const response = await fetch(
      `${relayUrl}/analyze/status?requestId=${encodeURIComponent(signature)}`,
    );
    const recovered = await readJsonResponse(response);
    if (recovered.state === "completed") {
      const validation = globalThis.ApplyOrNotAnalysis.validateModelOutput(
        recovered.analysis,
      );
      if (!validation.valid) {
        return {
          state: "error",
          error: "The local relay retained an invalid analysis result.",
        };
      }
    }
    if (recovered.state === "missing" || recovered.state === "canceled") {
      return {
        state: "error",
        error:
          recovered.state === "canceled"
            ? "The local analysis was canceled."
            : "The local relay no longer has this analysis. Please try again.",
      };
    }
    return recovered;
  } catch (error) {
    return {
      state: "error",
      error: `Could not recover the local analysis: ${error.message}`,
    };
  }
}

const analysisRunner = globalThis.ApplyOrNotAnalysisRunner.createAnalysisRunner({
  analyze: analyzeJob,
  storage: extensionApi.storage.local,
  cacheApi: globalThis.ApplyOrNotCache,
  updateBadge: safelyUpdateBadge,
  recover: recoverAnalysis,
});

extensionApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  let operation;

  if (message?.type === "analysis:health") {
    operation = checkRelay();
  } else if (message?.type === "analysis:key:set") {
    operation = configureRelay(message.apiKey);
  } else if (message?.type === "analysis:start") {
    analysisRunner
      .start(message.payload, message.context)
      .catch((error) => console.error("Background analysis failed.", error));
    operation = Promise.resolve({ started: true });
  } else if (message?.type === "analysis:run") {
    operation = analysisRunner.start(message.payload, message.context);
  } else if (message?.type === "analysis:cancel") {
    operation = cancelAnalysis(message.signature);
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
