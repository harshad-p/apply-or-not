const test = require("node:test");
const assert = require("node:assert/strict");

const cacheApi = require("../extension/shared/analysis-cache.js");
const {
  RUN_TIMEOUT_MS,
  RUNS_STORAGE_KEY,
  createAnalysisRunner,
} = require("../extension/shared/analysis-runner.js");

test("allows slow local analysis to remain active for more than five minutes", () => {
  assert.equal(RUN_TIMEOUT_MS, 330_000);
});

function createMemoryStorage() {
  const values = {};
  return {
    values,
    async get(keys) {
      return Object.fromEntries(
        keys.filter((key) => key in values).map((key) => [key, values[key]]),
      );
    },
    async set(update) {
      Object.assign(values, update);
    },
  };
}

test("finishes and caches analysis independently of a popup consumer", async () => {
  const storage = createMemoryStorage();
  const badges = [];
  const analysis = { score: 87, recommendation: "apply" };
  const runner = createAnalysisRunner({
    analyze: async () => {
      await new Promise((resolve) => setTimeout(resolve, 15));
      return analysis;
    },
    storage,
    cacheApi,
    updateBadge: async (_tabId, text) => badges.push(text),
  });
  const context = {
    pageUrl: "https://example.test/jobs/123",
    signature: "stable-job-signature",
    tabId: 7,
  };

  runner.start({ job: { title: "Backend Engineer" } }, context);
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal((await runner.getStatus(context.signature)).state, "running");

  await new Promise((resolve) => setTimeout(resolve, 30));
  const cache = storage.values[cacheApi.CACHE_STORAGE_KEY];
  assert.equal(cache.entries[0].analysis, analysis);
  assert.equal((await runner.getStatus(context.signature)).state, "idle");
  assert.deepEqual(badges, ["…", "87"]);
  assert.deepEqual(storage.values[RUNS_STORAGE_KEY], {});
});

test("records a background error for a reopened popup", async () => {
  const storage = createMemoryStorage();
  const runner = createAnalysisRunner({
    analyze: async () => {
      throw new Error("Provider unavailable");
    },
    storage,
    cacheApi,
  });
  const context = {
    pageUrl: "https://example.test/jobs/456",
    signature: "failed-job-signature",
    tabId: 8,
  };

  await assert.rejects(runner.start({}, context), /Provider unavailable/);
  const status = await runner.getStatus(context.signature);
  assert.equal(status.state, "error");
  assert.equal(status.error, "Provider unavailable");
});

test("cancels an active analysis and clears its persisted status", async () => {
  const storage = createMemoryStorage();
  const badges = [];
  const runner = createAnalysisRunner({
    analyze: (_payload, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      }),
    storage,
    cacheApi,
    updateBadge: async (_tabId, text) => badges.push(text),
  });
  const context = {
    pageUrl: "https://example.test/jobs/789",
    signature: "canceled-job-signature",
    tabId: 9,
  };

  const operation = runner.start({}, context);
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.deepEqual(await runner.cancel(context.signature), { canceled: true });
  await assert.rejects(operation, /Analysis canceled/);
  assert.equal((await runner.getStatus(context.signature)).state, "idle");
  assert.deepEqual(badges, ["…", ""]);
});

test("recovers an orphaned running status immediately", async () => {
  const storage = createMemoryStorage();
  const signature = "orphaned-job-signature";
  storage.values[RUNS_STORAGE_KEY] = {
    [signature]: {
      state: "running",
      pageUrl: "https://example.test/jobs/orphaned",
      tabId: 10,
      startedAt: Date.now(),
    },
  };
  const runner = createAnalysisRunner({
    analyze: async () => {},
    storage,
    cacheApi,
  });

  const status = await runner.getStatus(signature);
  assert.equal(status.state, "error");
  assert.match(status.error, /interrupted/);
});

test("restores a completed relay job after the worker restarts", async () => {
  const storage = createMemoryStorage();
  const signature = "recoverable-job-signature";
  const analysis = { score: 91, recommendation: "apply" };
  storage.values[RUNS_STORAGE_KEY] = {
    [signature]: {
      state: "running",
      pageUrl: "https://example.test/jobs/recoverable",
      tabId: 11,
      providerId: "local",
      startedAt: Date.now(),
    },
  };
  const runner = createAnalysisRunner({
    analyze: async () => {},
    storage,
    cacheApi,
    recover: async () => ({ state: "completed", analysis }),
  });

  assert.equal((await runner.getStatus(signature)).state, "idle");
  assert.equal(
    storage.values[cacheApi.CACHE_STORAGE_KEY].entries[0].analysis,
    analysis,
  );
});
