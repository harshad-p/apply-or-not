const test = require("node:test");
const assert = require("node:assert/strict");

const {
  extract,
  findJobPostingNode,
  normalizeText,
  scoreDetection,
} = require("../extension/content/extractor.js");

function textElement(text) {
  return {
    hidden: false,
    innerText: text,
    textContent: text,
    getAttribute: () => null,
  };
}

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

test("extracts LinkedIn-shaped job containers", () => {
  const description = textElement(
    "About the role. Responsibilities include building backend services. Requirements include production experience. ".repeat(
      6,
    ),
  );
  const title = textElement("Platform Engineer");
  const company = textElement("Example Networks");
  const documentRef = {
    title: "Platform Engineer | Example Networks",
    location: { href: "https://www.linkedin.com/jobs/view/123" },
    defaultView: {
      getComputedStyle: () => ({ display: "block", visibility: "visible" }),
    },
    querySelectorAll: (selector) => {
      if (selector === ".jobs-description__content") return [description];
      return [];
    },
    querySelector: (selector) => {
      if (selector === ".job-details-jobs-unified-top-card__job-title") {
        return title;
      }
      if (selector === ".job-details-jobs-unified-top-card__company-name") {
        return company;
      }
      return null;
    },
  };

  const result = extract(documentRef);

  assert.equal(result.isLikelyJobPosting, true);
  assert.equal(result.job.title, "Platform Engineer");
  assert.equal(result.job.company, "Example Networks");
  assert.equal(result.extraction.source, "LinkedIn job description");
});
