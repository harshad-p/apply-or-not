const test = require("node:test");
const assert = require("node:assert/strict");

const {
  findJobPostingNode,
  normalizeText,
  scoreDetection,
} = require("../extension/content/extractor.js");

test("normalizes whitespace without flattening paragraphs", () => {
  assert.equal(
    normalizeText("  First\u00a0line  \n\n\n Second   line  "),
    "First line\n\nSecond line",
  );
});

test("finds a JobPosting nested inside an @graph", () => {
  const job = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", name: "Example GmbH" },
      { "@type": "JobPosting", title: "Backend Developer" },
    ],
  };

  assert.deepEqual(findJobPostingNode(job), job["@graph"][1]);
});

test("strong structured evidence identifies a job posting", () => {
  const result = scoreDetection({
    hasStructuredJob: true,
    pageTitle: "Backend Developer — Example GmbH",
    pageUrl: "https://example.test/openings/123",
    description: "Responsibilities and qualifications ".repeat(30),
  });

  assert.ok(result.score >= 90);
  assert.ok(result.signals.includes("JobPosting structured data"));
});

test("a long ordinary article is not automatically classified as a job", () => {
  const result = scoreDetection({
    pageTitle: "How distributed systems handle retries",
    pageUrl: "https://example.test/articles/retries",
    description: "An engineering article about reliable systems. ".repeat(40),
  });

  assert.ok(result.score < 50);
});

test("German job signals work without structured data", () => {
  const result = scoreDetection({
    hasSpecificContainer: true,
    pageTitle: "Softwareentwickler Stelle",
    pageUrl: "https://example.test/stellen/entwickler",
    description:
      "Deine Aufgaben umfassen Backend-Entwicklung. Dein Profil und unsere Anforderungen werden hier ausführlich beschrieben. ".repeat(
        8,
      ),
  });

  assert.ok(result.score >= 50);
});
