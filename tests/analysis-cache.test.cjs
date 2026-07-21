const test = require("node:test");
const assert = require("node:assert/strict");

const {
  MAX_CACHE_AGE_MS,
  MAX_CACHE_ENTRIES,
  createSignature,
  findEntry,
  upsertEntry,
} = require("../extension/shared/analysis-cache.js");

function signatureInput(overrides = {}) {
  return {
    pageUrl: "https://example.test/jobs/123",
    job: {
      title: "Backend Engineer",
      description: "Build APIs with C#.",
      application: { method: "easy_apply", label: "Easy Apply" },
    },
    userCriteria: "Easy Apply only.",
    preferredLanguage: "English",
    promptVersion: "job-fit-v6",
    ...overrides,
  };
}

test("creates stable cache signatures from job identity and analysis settings", () => {
  const original = createSignature(signatureInput());

  assert.equal(original, createSignature(signatureInput()));
  assert.notEqual(
    original,
    createSignature(signatureInput({ userCriteria: "Remote only." })),
  );
  assert.equal(
    original,
    createSignature({
      ...signatureInput(),
      job: {
        ...signatureInput().job,
        description: "LinkedIn dynamically changed surrounding page text.",
        application: { method: "external_apply", label: "Apply" },
      },
    }),
  );
  assert.notEqual(
    original,
    createSignature({
      ...signatureInput(),
      job: { ...signatureInput().job, title: "Platform Engineer" },
    }),
  );
  assert.notEqual(
    original,
    createSignature(signatureInput({ promptVersion: "job-fit-v7" })),
  );
});

test("finds a matching unexpired entry", () => {
  const now = 2_000_000;
  const signature = createSignature(signatureInput());
  const entry = {
    pageUrl: signatureInput().pageUrl,
    signature,
    createdAt: now - 1000,
    analysis: { score: 91 },
  };

  assert.deepEqual(
    findEntry({ version: 1, entries: [entry] }, {
      pageUrl: entry.pageUrl,
      signature,
      now,
    }),
    entry,
  );
});

test("ignores expired and changed results", () => {
  const now = 50_000_000_000;
  const entry = {
    pageUrl: signatureInput().pageUrl,
    signature: createSignature(signatureInput()),
    createdAt: now - MAX_CACHE_AGE_MS - 1,
    analysis: { score: 91 },
  };
  const cache = { version: 1, entries: [entry] };

  assert.equal(
    findEntry(cache, {
      pageUrl: entry.pageUrl,
      signature: entry.signature,
      now,
    }),
    null,
  );
  assert.equal(
    findEntry(cache, {
      pageUrl: entry.pageUrl,
      signature: "changed",
      now: entry.createdAt + 1,
    }),
    null,
  );
});

test("keeps only the newest bounded result per URL", () => {
  let cache = { version: 1, entries: [] };
  for (let index = 0; index < MAX_CACHE_ENTRIES + 5; index += 1) {
    cache = upsertEntry(cache, {
      pageUrl: `https://example.test/jobs/${index}`,
      signature: String(index),
      createdAt: index + 1,
      analysis: { score: index },
    });
  }

  cache = upsertEntry(cache, {
    pageUrl: "https://example.test/jobs/20",
    signature: "new",
    createdAt: 999,
    analysis: { score: 99 },
  });

  assert.equal(cache.entries.length, MAX_CACHE_ENTRIES);
  assert.equal(cache.entries[0].signature, "new");
  assert.equal(
    cache.entries.filter((entry) => entry.pageUrl.endsWith("/20")).length,
    1,
  );
});
