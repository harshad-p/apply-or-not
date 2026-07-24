(() => {
  "use strict";

  const RUNS_STORAGE_KEY = "analysisRunsV1";
  const RUN_TIMEOUT_MS = 90_000;

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

    async function run(payload, context) {
      const startedAt = now();
      await setStatus(context.signature, {
        state: "running",
        pageUrl: context.pageUrl,
        startedAt,
      });
      await updateBadge(context.tabId, "…", "#526158");

      try {
        const analysis = await analyze(payload);
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
      if (existing) return existing;

      const operation = run(payload, context);
      inFlight.set(context.signature, operation);
      return operation;
    }

    async function getStatus(signature) {
      if (!signature) return { state: "idle" };
      const runs = await readRuns();
      const status = runs[signature];
      if (!status) return { state: "idle" };

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

    return Object.freeze({ getStatus, start });
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
