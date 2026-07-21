const test = require("node:test");
const assert = require("node:assert/strict");

const {
  extract,
  extractApplicationMethod,
  findJobPostingNode,
  getStructuredCompanyContext,
  isKnownJobPageUrl,
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

function controlElement(text, attributes = {}) {
  return {
    ...textElement(text),
    getAttribute: (name) => attributes[name] ?? null,
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

test("extracts structured company industry and description evidence", () => {
  const context = getStructuredCompanyContext({
    industry: "Aviation analytics",
    hiringOrganization: {
      industry: "Software",
      description: "Builds operational tools for airlines.",
    },
  });

  assert.match(context, /Industry: Aviation analytics, Software/);
  assert.match(context, /operational tools for airlines/);
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

test("recognizes direct and selected LinkedIn job URLs", () => {
  assert.equal(
    isKnownJobPageUrl("https://www.linkedin.com/jobs/view/123456"),
    true,
  );
  assert.equal(
    isKnownJobPageUrl(
      "https://www.linkedin.com/jobs/search/?keywords=backend&currentJobId=123456",
    ),
    true,
  );
  assert.equal(
    isKnownJobPageUrl("https://www.linkedin.com/jobs/search/?keywords=backend"),
    false,
  );
});

test("recognizes a LinkedIn job when its current layout exposes only main text", () => {
  const result = scoreDetection({
    pageTitle: "Backend Engineer | Example GmbH | LinkedIn",
    pageUrl:
      "https://www.linkedin.com/jobs/search/?keywords=backend&currentJobId=123456",
    description: "Backend engineering position with production systems experience. ".repeat(12),
  });

  assert.ok(result.score >= 50);
  assert.ok(result.signals.includes("recognized job-site posting URL"));
});

test("extracts LinkedIn-shaped job containers", () => {
  const description = textElement(
    "About the role. Responsibilities include building backend services. Requirements include production experience. ".repeat(
      6,
    ),
  );
  const title = textElement("Platform Engineer");
  const company = textElement("Example Networks");
  const companyContext = textElement(
    "About the company. Example Networks builds analytics software for aviation operators.",
  );
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
      if (selector === ".jobs-company__box") return companyContext;
      return null;
    },
  };

  const result = extract(documentRef);

  assert.equal(result.isLikelyJobPosting, true);
  assert.equal(result.job.title, "Platform Engineer");
  assert.equal(result.job.company, "Example Networks");
  assert.match(result.job.companyContext, /analytics software for aviation/);
  assert.equal(result.job.companyEvidenceSource, "LinkedIn company panel");
  assert.equal(result.extraction.source, "LinkedIn job description");
});

test("extracts LinkedIn job details by stable id", () => {
  const description = textElement(
    "About the job. Responsibilities include API development and cloud operations. Requirements include backend experience and English communication. ".repeat(
      5,
    ),
  );
  const documentRef = {
    title: "Backend Engineer | Example Company",
    location: { href: "https://www.linkedin.com/jobs/view/456" },
    defaultView: {
      getComputedStyle: () => ({ display: "block", visibility: "visible" }),
    },
    querySelectorAll: (selector) => {
      if (selector === "#job-details") return [description];
      return [];
    },
    querySelector: () => null,
  };

  const result = extract(documentRef);

  assert.equal(result.isLikelyJobPosting, true);
  assert.equal(result.extraction.source, "LinkedIn job details");
  assert.ok(result.extraction.characterCount > 200);
});

test("detects Easy Apply from a visible application control", () => {
  const easyApplyButton = controlElement("Easy Apply", {
    "aria-label": "Easy Apply to Backend Engineer",
  });
  const documentRef = {
    defaultView: {
      getComputedStyle: () => ({ display: "block", visibility: "visible" }),
    },
    querySelectorAll: (selector) =>
      selector === "button, a[role='button'], a[href]" ? [easyApplyButton] : [],
  };

  assert.deepEqual(extractApplicationMethod(documentRef), {
    method: "easy_apply",
    label: "Easy Apply",
    confidence: "high",
  });
});

test("ignores Easy Apply controls from unrelated LinkedIn job cards", () => {
  const unrelatedEasyApply = controlElement("Easy Apply", {
    "aria-label": "Easy Apply to a different job",
  });
  const documentRef = {
    location: { href: "https://www.linkedin.com/jobs/view/123" },
    defaultView: {
      getComputedStyle: () => ({ display: "block", visibility: "visible" }),
    },
    querySelectorAll: (selector) =>
      selector === "button, a[role='button'], a[href]"
        ? [unrelatedEasyApply]
        : [],
  };

  assert.deepEqual(extractApplicationMethod(documentRef, "Backend Engineer"), {
    method: "unknown",
    label: "Application method not detected",
    confidence: "low",
  });
});

test("prefers the selected LinkedIn job apply control over other buttons", () => {
  const selectedApply = controlElement("Apply", {
    "aria-label": "Apply to Backend Engineer",
  });
  const unrelatedEasyApply = controlElement("Easy Apply");
  const selectedSelector = [
    ".jobs-apply-button",
    ".jobs-s-apply button",
    "[data-live-test-job-apply-button]",
    "#indeedApplyButton",
    "[data-testid='indeedApplyButton']",
    "[data-test='applyButton']",
    "[data-testid='apply-button']",
  ].join(", ");
  const documentRef = {
    location: { href: "https://www.linkedin.com/jobs/view/123" },
    defaultView: {
      getComputedStyle: () => ({ display: "block", visibility: "visible" }),
    },
    querySelectorAll: (selector) => {
      if (selector === selectedSelector) return [selectedApply];
      if (selector === "button, a[role='button'], a[href]") {
        return [unrelatedEasyApply, selectedApply];
      }
      return [];
    },
  };

  assert.deepEqual(extractApplicationMethod(documentRef, "Backend Engineer"), {
    method: "external_apply",
    label: "Apply",
    confidence: "medium",
  });
});

test("distinguishes an external Apply control from Easy Apply", () => {
  const applyLink = controlElement("Apply now");
  const documentRef = {
    defaultView: {
      getComputedStyle: () => ({ display: "block", visibility: "visible" }),
    },
    querySelectorAll: (selector) =>
      selector === "button, a[role='button'], a[href]" ? [applyLink] : [],
  };

  assert.deepEqual(extractApplicationMethod(documentRef), {
    method: "external_apply",
    label: "Apply now",
    confidence: "medium",
  });
});
