const test = require("node:test");
const assert = require("node:assert/strict");

const analysisContract = require("../extension/shared/analysis-contract.js");
const demo = require("../extension/shared/demo-data.js");

test("provides a valid deterministic no-cost demo result", () => {
  const first = demo.createDemoResult();
  const second = demo.createDemoResult();

  assert.deepEqual(first, second);
  assert.deepEqual(analysisContract.validateModelOutput(first.analysis), {
    valid: true,
    errors: [],
  });
  assert.equal(first.analysis.provider.model, "demo-fixture");
  assert.equal(first.extraction.job.application.method, "easy_apply");
});

test("labels all demo content as synthetic and local", () => {
  const { extraction, analysis } = demo.createDemoResult();

  assert.match(extraction.extraction.source, /synthetic fixture/i);
  assert.match(analysis.provider.responseId, /local-synthetic-demo/);
  assert.match(analysis.summary, /synthetic role/i);
});
