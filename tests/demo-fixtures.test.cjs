const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const fixtureDirectory = path.join(__dirname, "../extension/fixtures");
const scenarioFiles = [
  "demo-language-de.html",
  "demo-transferable-sql.html",
  "demo-domain-aviation.html",
  "demo-hard-blocker.html",
];

test("video demo scenarios contain valid, clearly labeled JobPosting data", () => {
  for (const file of scenarioFiles) {
    const html = fs.readFileSync(path.join(fixtureDirectory, file), "utf8");
    const match = html.match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
    );

    assert.ok(match, `${file} should contain JSON-LD`);
    const posting = JSON.parse(match[1]);
    assert.equal(posting["@type"], "JobPosting");
    assert.ok(posting.title);
    assert.ok(posting.hiringOrganization?.name);
    assert.ok(posting.description.length >= 200);
    assert.match(html, /synthetic demo/i);
    assert.match(html, /data-fixture-result/);
  }
});

test("scenario launcher links to every video fixture", () => {
  const launcher = fs.readFileSync(
    path.join(fixtureDirectory, "demo-scenarios.html"),
    "utf8",
  );
  for (const file of scenarioFiles) assert.match(launcher, new RegExp(file));
});
