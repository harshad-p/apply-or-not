(() => {
  "use strict";

  const RUNS_STORAGE_KEY = "analysisRunsV1";
  const RUN_TIMEOUT_MS = 330_000;

  function createAnalysisRunner({
    analyze,
    storage,
    cacheApi,
    updateBadge = async () => {},
    now = () => Date.now(),
  }) {
    const inFlight = new Map();
    let statusMutation = Promise.resolve();

    async function readRuns() {
      const stored = await storage.get([RUNS_STORAGE_KEY]);
      const runs = stored?.[RUNS_STORAGE_KEY];
      return runs && typeof runs === "object" ? runs : {};
    }

    function mutateRuns(mutation) {
      statusMutation = statusMutation.catch(() => {}).then(async () => {
        const runs = await readRuns();
        mutation(runs);
        await storage.set({ [RUNS_STORAGE_KEY]: runs });
      });
      return statusMutation;
    }

    async function setStatus(signature, status) {
      await mutateRuns((runs) => {
        runs[signature] = status;
      });
    }

    async function clearStatus(signature) {
      await mutateRuns((runs) => {
        delete runs[signature];
      });
    }

    async function saveAnalysis(context, analysis, createdAt) {
      const stored = await storage.get([cacheApi.CACHE_STORAGE_KEY]);
      const cache = cacheApi.upsertEntry(stored[cacheApi.CACHE_STORAGE_KEY], {
        pageUrl: context.pageUrl,
        signature: context.signature,
        createdAt,
        analysis,
      });
      await storage.set({ [cacheApi.CACHE_STORAGE_KEY]: cache });
    }

    async function run(payload, context, signal) {
      const startedAt = now();
      await setStatus(context.signature, {
        state: "running",
        pageUrl: context.pageUrl,
        tabId: context.tabId,
        startedAt,
      });
      await updateBadge(context.tabId, "…", "#526158");

      try {
        const analysis = await analyze(payload, { signal });
        const createdAt = now();
        await saveAnalysis(context, analysis, createdAt);
        await clearStatus(context.signature);
        const color =
          analysis.score >= 80
            ? "#2f7d4a"
            : analysis.score >= 60
              ? "#b46b12"
              : "#a84035";
        await updateBadge(context.tabId, String(analysis.score), color);
        return { analysis, createdAt, cacheSaved: true };
      } catch (error) {
        if (signal.aborted) {
          await clearStatus(context.signature);
          await updateBadge(context.tabId, "", "#526158");
          throw new Error("Analysis canceled.");
        }
        await setStatus(context.signature, {
          state: "error",
          pageUrl: context.pageUrl,
          startedAt,
          finishedAt: now(),
          error: error?.message || "Analysis failed.",
        });
        await updateBadge(context.tabId, "!", "#a84035");
        throw error;
      } finally {
        inFlight.delete(context.signature);
      }
    }

    function start(payload, context) {
      if (!context?.signature || !context?.pageUrl) {
        return Promise.reject(new Error("Analysis context is incomplete."));
      }
      const existing = inFlight.get(context.signature);
      if (existing) return existing.operation;

      const controller = new AbortController();
      const operation = run(payload, context, controller.signal);
      inFlight.set(context.signature, { controller, operation });
      return operation;
    }

    async function cancel(signature) {
      if (!signature) {
        throw new Error("Analysis signature is missing.");
      }

      const active = inFlight.get(signature);
      if (active) {
        active.controller.abort();
        try {
          await active.operation;
        } catch {
          // Cancellation intentionally rejects the original analysis request.
        }
        return { canceled: true };
      }

      const runs = await readRuns();
      const status = runs[signature];
      await clearStatus(signature);
      if (status?.tabId) {
        await updateBadge(status.tabId, "", "#526158");
      }
      return { canceled: Boolean(status) };
    }

    async function getStatus(signature) {
      if (!signature) return { state: "idle" };
      const runs = await readRuns();
      const status = runs[signature];
      if (!status) return { state: "idle" };

      if (status.state === "running" && !inFlight.has(signature)) {
        const interrupted = {
          ...status,
          state: "error",
          finishedAt: now(),
          error:
            "The previous background analysis was interrupted. Please try again.",
        };
        await setStatus(signature, interrupted);
        if (status.tabId) {
          await updateBadge(status.tabId, "!", "#a84035");
        }
        return interrupted;
      }

      if (
        status.state === "running" &&
        now() - status.startedAt > RUN_TIMEOUT_MS
      ) {
        const expired = {
          ...status,
          state: "error",
          finishedAt: now(),
          error: "The background analysis did not finish. Please try again.",
        };
        await setStatus(signature, expired);
        return expired;
      }
      return status;
    }

    return Object.freeze({ cancel, getStatus, start });
  }

  const api = Object.freeze({
    RUNS_STORAGE_KEY,
    RUN_TIMEOUT_MS,
    createAnalysisRunner,
  });

  if (typeof globalThis === "object") {
    globalThis.ApplyOrNotAnalysisRunner = api;
  }

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
})();
