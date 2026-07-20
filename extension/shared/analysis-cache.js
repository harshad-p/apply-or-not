(() => {
  "use strict";

  const CACHE_STORAGE_KEY = "analysisCacheV1";
  const CACHE_VERSION = 1;
  const MAX_CACHE_AGE_MS = 30 * 24 * 60 * 60 * 1000;
  const MAX_CACHE_ENTRIES = 30;

  function hashString(value) {
    const input = String(value ?? "");
    let first = 0xdeadbeef ^ input.length;
    let second = 0x41c6ce57 ^ input.length;

    for (let index = 0; index < input.length; index += 1) {
      const code = input.charCodeAt(index);
      first = Math.imul(first ^ code, 2654435761);
      second = Math.imul(second ^ code, 1597334677);
    }

    first =
      Math.imul(first ^ (first >>> 16), 2246822507) ^
      Math.imul(second ^ (second >>> 13), 3266489909);
    second =
      Math.imul(second ^ (second >>> 16), 2246822507) ^
      Math.imul(first ^ (first >>> 13), 3266489909);

    return `${(second >>> 0).toString(16).padStart(8, "0")}${(first >>> 0)
      .toString(16)
      .padStart(8, "0")}`;
  }

  function createSignature({
    pageUrl,
    job,
    userCriteria,
    preferredLanguage,
    promptVersion,
  }) {
    return hashString(
      JSON.stringify([
        pageUrl || "",
        job?.title || "",
        job?.company || "",
        job?.location || "",
        job?.description || "",
        job?.application?.method || "unknown",
        job?.application?.label || "",
        userCriteria || "",
        preferredLanguage || "",
        promptVersion || "",
      ]),
    );
  }

  function normalizeCache(value) {
    if (
      !value ||
      value.version !== CACHE_VERSION ||
      !Array.isArray(value.entries)
    ) {
      return { version: CACHE_VERSION, entries: [] };
    }

    return {
      version: CACHE_VERSION,
      entries: value.entries.filter(
        (entry) =>
          entry &&
          typeof entry.pageUrl === "string" &&
          typeof entry.signature === "string" &&
          Number.isFinite(entry.createdAt) &&
          entry.analysis,
      ),
    };
  }

  function findEntry(cacheValue, { pageUrl, signature, now = Date.now() }) {
    const cache = normalizeCache(cacheValue);
    return (
      cache.entries.find(
        (entry) =>
          entry.pageUrl === pageUrl &&
          entry.signature === signature &&
          now - entry.createdAt <= MAX_CACHE_AGE_MS &&
          now >= entry.createdAt,
      ) || null
    );
  }

  function upsertEntry(cacheValue, entry) {
    const cache = normalizeCache(cacheValue);
    const entries = [
      entry,
      ...cache.entries.filter(
        (existing) => existing.pageUrl !== entry.pageUrl,
      ),
    ].slice(0, MAX_CACHE_ENTRIES);
    return { version: CACHE_VERSION, entries };
  }

  const api = Object.freeze({
    CACHE_STORAGE_KEY,
    CACHE_VERSION,
    MAX_CACHE_AGE_MS,
    MAX_CACHE_ENTRIES,
    createSignature,
    findEntry,
    hashString,
    normalizeCache,
    upsertEntry,
  });

  if (typeof globalThis === "object") {
    globalThis.ApplyOrNotCache = api;
  }

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
})();
