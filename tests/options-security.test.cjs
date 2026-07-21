const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const optionsHtml = fs.readFileSync(
  path.join(__dirname, "../extension/options/options.html"),
  "utf8",
);

test("keeps the transient API key outside forms and password controls", () => {
  const formEnd = optionsHtml.indexOf("</form>");
  const apiKeyControl = optionsHtml.indexOf('id="api-key"');

  assert.ok(formEnd >= 0);
  assert.ok(apiKeyControl > formEnd);
  assert.doesNotMatch(optionsHtml, /type=["']password["']/i);
  assert.match(optionsHtml, /<textarea[\s\S]*?id="api-key"/i);
});
