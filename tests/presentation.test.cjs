const test = require("node:test");
const assert = require("node:assert/strict");

const {
  formatConfidence,
  formatModelLabel,
  getRecommendationPresentation,
} = require("../extension/shared/presentation.js");

test("maps every recommendation to a color-independent label and symbol", () => {
  assert.deepEqual(
    ["apply", "consider", "skip"].map((value) => {
      const result = getRecommendationPresentation(value);
      return [result.label, result.symbol, result.state];
    }),
    [
      ["Apply", "✓", "apply"],
      ["Consider", "!", "consider"],
      ["Skip", "×", "skip"],
    ],
  );
});

test("formats returned GPT-5.6 model snapshots for the popup", () => {
  assert.equal(
    formatModelLabel("gpt-5.6-sol-2026-07-01"),
    "GPT-5.6 Sol",
  );
  assert.equal(formatModelLabel("custom-local-model"), "custom-local-model");
});

test("formats confidence as a readable label", () => {
  assert.equal(formatConfidence("high"), "High confidence");
});
