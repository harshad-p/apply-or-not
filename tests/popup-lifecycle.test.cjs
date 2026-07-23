const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const popupSource = fs.readFileSync(
  path.join(__dirname, "../extension/popup/popup.js"),
  "utf8",
);
const backgroundSource = fs.readFileSync(
  path.join(__dirname, "../extension/background/service-worker.js"),
  "utf8",
);

test("starts analysis without holding the popup message open", () => {
  assert.match(popupSource, /type:\s*"analysis:start"/);
  assert.match(popupSource, /await monitorBackgroundAnalysis/);
  assert.match(backgroundSource, /message\?\.type === "analysis:start"/);
  assert.match(backgroundSource, /Promise\.resolve\(\{ started: true \}\)/);
});

test("shows trusted analysis duration with saved results", () => {
  assert.match(popupSource, /analysis\.provider\.durationMs/);
  assert.match(popupSource, /completed in/);
});
