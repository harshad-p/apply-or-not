const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const manifest = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../extension/manifest.json"),
    "utf8",
  ),
);

test("provides Manifest V3 background entry points across browsers", () => {
  assert.equal(
    manifest.background.service_worker,
    "background/service-worker.js",
  );
  assert.ok(manifest.background.scripts.includes("background/service-worker.js"));
  assert.deepEqual(manifest.background.preferred_environment, [
    "service_worker",
    "document",
  ]);
});

test("background validation keeps the extracted job context", () => {
  const worker = fs.readFileSync(
    path.join(__dirname, "../extension/background/service-worker.js"),
    "utf8",
  );
  assert.match(
    worker,
    /validateModelOutput\(\s*body\.analysis,\s*payload,?\s*\)/u,
  );
});
