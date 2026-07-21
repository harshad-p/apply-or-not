(() => {
  "use strict";

  const MIN_DESCRIPTION_LENGTH = 200;
  const MAX_DESCRIPTION_LENGTH = 50000;
  const MAX_COMPANY_CONTEXT_LENGTH = 8000;

  const candidateSelectors = [
    {
      selector: "#job-details",
      source: "LinkedIn job details",
      boost: 42,
    },
    {
      selector: ".jobs-description__container",
      source: "LinkedIn job description",
      boost: 40,
    },
    {
      selector: ".jobs-description__content",
      source: "LinkedIn job description",
      boost: 40,
    },
    {
      selector: ".jobs-description-content__text",
      source: "LinkedIn job description",
      boost: 40,
    },
    {
      selector: ".jobs-box__html-content",
      source: "LinkedIn job description",
      boost: 38,
    },
    {
      selector: "[class*='jobs-description' i]",
      source: "LinkedIn job description",
      boost: 35,
    },
    {
      selector: "[class*='jobs-description-content' i]",
      source: "LinkedIn job description",
      boost: 35,
    },
    { selector: "[itemprop='description']", source: "structured element", boost: 35 },
    { selector: "[data-testid*='job-description' i]", source: "job description", boost: 35 },
    { selector: "[data-test*='job-description' i]", source: "job description", boost: 35 },
    { selector: "[id*='job-description' i]", source: "job description", boost: 30 },
    { selector: "[class*='job-description' i]", source: "job description", boost: 30 },
    { selector: "[id*='jobDescription']", source: "job description", boost: 30 },
    { selector: "[class*='jobDescription']", source: "job description", boost: 30 },
    { selector: "article", source: "article", boost: 8 },
    { selector: "main", source: "main content", boost: 0 },
  ];

  const titleSelectors = [
    ".job-details-jobs-unified-top-card__job-title",
    ".jobs-unified-top-card__job-title",
    "[data-testid*='job-title' i]",
    "[data-test*='job-title' i]",
    "[class*='job-title' i]",
    "[itemprop='title']",
    "h1",
  ];

  const companySelectors = [
    ".job-details-jobs-unified-top-card__company-name",
    ".jobs-unified-top-card__company-name",
    "[itemprop='hiringOrganization'] [itemprop='name']",
    "[data-testid*='company-name' i]",
    "[data-test*='company-name' i]",
    "[class*='company-name' i]",
  ];

  const companyContextSelectors = [
    ".jobs-company__box",
    ".jobs-company__content",
    "[itemprop='hiringOrganization'] [itemprop='description']",
    "[data-testid*='company-description' i]",
    "[data-test*='company-description' i]",
    "[class*='company-description' i]",
  ];

  const jobPagePattern =
    /\b(job|jobs|career|careers|position|positions|vacancy|vacancies|role|roles|stelle|stellen|stellenangebot|stellenanzeige)\b|求人|採用|募集/iu;

  function isKnownJobPageUrl(value) {
    try {
      const url = new URL(value);
      const host = url.hostname.toLowerCase();
      const path = url.pathname.toLowerCase();

      if (host.endsWith("linkedin.com")) {
        return path.includes("/jobs/view/") || url.searchParams.has("currentJobId");
      }
      if (host.endsWith("indeed.com") || host.includes(".indeed.")) {
        return path.includes("/viewjob") || url.searchParams.has("jk");
      }
      if (host.endsWith("glassdoor.com") || host.includes(".glassdoor.")) {
        return path.includes("/job-listing/");
      }
      if (host.endsWith("xing.com")) {
        return path.includes("/jobs/");
      }
      return false;
    } catch {
      return false;
    }
  }

  const descriptionSignalPatterns = [
    /\bresponsibilit(?:y|ies)\b/iu,
    /\bqualifications?\b/iu,
    /\brequirements?\b/iu,
    /\babout (?:the|this) role\b/iu,
    /\bwhat (?:you(?:'|’)ll|you will) do\b/iu,
    /\bwhat we offer\b/iu,
    /\baufgaben\b/iu,
    /\banforderungen\b/iu,
    /\bqualifikationen\b/iu,
    /\büber den job\b/iu,
    /\bwas (?:du|sie) (?:tun|machen|mitbringen)\b/iu,
    /\b(?:dein|ihr) profil\b/iu,
    /仕事内容/u,
    /応募資格/u,
    /業務内容/u,
  ];

  const jobSectionHeadingPattern =
    /^(about the (?:job|role|position)|job description|the role|stellenbeschreibung|über (?:den job|die stelle|diese stelle)|description du poste|descripción del puesto|descrição da vaga|仕事内容|職務内容)$/iu;

  const easyApplyPattern =
    /\b(easy apply|easily apply|quick apply|einfach bewerben|schnell bewerben|candidature simplifiée|postulación sencilla|candidatura semplificata)\b|簡単応募/iu;
  const externalApplyPattern =
    /^(apply|apply now|bewerben|jetzt bewerben|postuler|candidater|solicitar|candidatar-se|応募|今すぐ応募)(?:\b|$)/iu;
  const selectedJobApplySelector = [
    ".jobs-apply-button",
    ".jobs-s-apply button",
    "[data-live-test-job-apply-button]",
    "#indeedApplyButton",
    "[data-testid='indeedApplyButton']",
    "[data-test='applyButton']",
    "[data-testid='apply-button']",
  ].join(", ");
  const selectedJobStatusSelector = [
    ".jobs-unified-top-card",
    ".job-details-jobs-unified-top-card",
    ".jobs-details",
    "[data-testid*='job-header' i]",
    "[data-test*='job-header' i]",
    "[itemprop='JobPosting']",
  ].join(", ");
  const closedApplicationPattern =
    /\b(?:no longer accepting applications|applications? (?:are |is )?(?:now )?closed|applications? (?:are |is )?no longer being accepted|application (?:period|window) (?:has )?(?:ended|closed)|position (?:has been|is) filled|job (?:is )?(?:no longer available|closed|expired))\b|\b(?:keine bewerbungen mehr|bewerbungsfrist abgelaufen|bewerbungsphase beendet|stelle nicht mehr verfügbar)\b|n[’']accepte plus (?:les )?candidatures|candidatures? clôturées?|ya no se aceptan solicitudes|oferta cerrada|応募受付(?:は)?終了|募集終了/iu;

  function normalizeText(value) {
    return String(value ?? "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function findJobPostingNode(value) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const match = findJobPostingNode(item);
        if (match) return match;
      }
      return null;
    }

    if (!value || typeof value !== "object") {
      return null;
    }

    const types = Array.isArray(value["@type"])
      ? value["@type"]
      : [value["@type"]];

    if (types.some((type) => String(type).toLowerCase() === "jobposting")) {
      return value;
    }

    for (const nestedValue of Object.values(value)) {
      const match = findJobPostingNode(nestedValue);
      if (match) return match;
    }

    return null;
  }

  function htmlToText(documentRef, html) {
    if (!html) return "";
    const container = documentRef.createElement("div");
    container.innerHTML = String(html);
    return normalizeText(container.innerText || container.textContent);
  }

  function getOrganizationName(organization) {
    if (typeof organization === "string") return normalizeText(organization);
    return normalizeText(organization?.name);
  }

  function getStructuredCompanyContext(jobPosting) {
    const organization = jobPosting?.hiringOrganization;
    const organizationDescription =
      organization && typeof organization === "object"
        ? organization.description
        : "";
    const industries = [];
    for (const value of [
      jobPosting?.industry,
      organization && typeof organization === "object"
        ? organization.industry
        : "",
    ]) {
      const values = Array.isArray(value) ? value : [value];
      for (const entry of values) {
        if (entry) industries.push(normalizeText(entry));
      }
    }

    return normalizeText(
      [
        industries.length ? `Industry: ${[...new Set(industries)].join(", ")}` : "",
        organizationDescription,
      ]
        .filter(Boolean)
        .join("\n\n"),
    ).slice(0, MAX_COMPANY_CONTEXT_LENGTH);
  }

  function getLocationText(location) {
    const locations = Array.isArray(location) ? location : [location];
    const labels = locations
      .filter(Boolean)
      .map((entry) => {
        if (typeof entry === "string") return normalizeText(entry);
        const address = entry.address ?? entry;
        if (typeof address === "string") return normalizeText(address);
        return normalizeText(
          [
            address?.addressLocality,
            address?.addressRegion,
            address?.addressCountry?.name ?? address?.addressCountry,
          ]
            .filter(Boolean)
            .join(", "),
        );
      })
      .filter(Boolean);

    return [...new Set(labels)].join("; ");
  }

  function extractStructuredJob(documentRef) {
    const scripts = documentRef.querySelectorAll(
      "script[type='application/ld+json']",
    );

    for (const script of scripts) {
      try {
        const parsed = JSON.parse(script.textContent);
        const node = findJobPostingNode(parsed);
        if (!node) continue;

        let companyContext = "";
        try {
          companyContext = htmlToText(
            documentRef,
            getStructuredCompanyContext(node),
          );
        } catch {
          // Optional company enrichment must never prevent core job extraction.
        }

        return {
          node,
          title: normalizeText(node.title),
          company: getOrganizationName(node.hiringOrganization),
          location: getLocationText(node.jobLocation),
          description: htmlToText(documentRef, node.description),
          companyContext,
          validThrough: normalizeText(node.validThrough),
        };
      } catch {
        // Invalid JSON-LD from the page should not prevent visible-text extraction.
      }
    }

    return null;
  }

  function isElementVisible(element, documentRef) {
    if (!element || element.hidden || element.getAttribute("aria-hidden") === "true") {
      return false;
    }

    const style = documentRef.defaultView?.getComputedStyle?.(element);
    return !style || (style.display !== "none" && style.visibility !== "hidden");
  }

  function collectDescriptionCandidates(documentRef) {
    const candidates = [];
    const visited = new Set();

    for (const definition of candidateSelectors) {
      let elements = [];
      try {
        elements = documentRef.querySelectorAll(definition.selector);
      } catch {
        continue;
      }

      for (const element of elements) {
        if (visited.has(element) || !isElementVisible(element, documentRef)) continue;
        visited.add(element);

        const text = normalizeText(element.innerText || element.textContent);
        if (text.length < MIN_DESCRIPTION_LENGTH) continue;

        const score = Math.min(text.length / 80, 60) + definition.boost;
        candidates.push({
          text,
          score,
          source: definition.source,
          isSpecific: definition.boost >= 30,
        });
      }
    }

    let headings = [];
    try {
      headings = documentRef.querySelectorAll("h1, h2, h3, h4");
    } catch {
      headings = [];
    }

    for (const heading of headings) {
      const headingText = normalizeText(heading.innerText || heading.textContent);
      if (!jobSectionHeadingPattern.test(headingText)) continue;

      let container = heading.parentElement;
      for (let depth = 0; container && depth < 4; depth += 1) {
        const text = normalizeText(container.innerText || container.textContent);
        if (
          text.length >= MIN_DESCRIPTION_LENGTH &&
          isElementVisible(container, documentRef)
        ) {
          if (!visited.has(container)) {
            visited.add(container);
            candidates.push({
              text,
              score: Math.min(text.length / 80, 60) + 34,
              source: `section headed “${headingText}”`,
              isSpecific: true,
            });
          }
          break;
        }
        container = container.parentElement;
      }
    }

    return candidates.sort((left, right) => right.score - left.score);
  }

  function getFirstText(documentRef, selectors) {
    for (const selector of selectors) {
      try {
        const element = documentRef.querySelector(selector);
        const text = normalizeText(element?.innerText || element?.textContent);
        if (text) return text;
      } catch {
        // Continue to the next generic selector.
      }
    }
    return "";
  }

  function extractVisibleCompanyContext(documentRef) {
    for (const selector of companyContextSelectors) {
      try {
        const element = documentRef.querySelector(selector);
        if (!isElementVisible(element, documentRef)) continue;
        const text = normalizeText(element.innerText || element.textContent);
        if (text.length >= 40) {
          return {
            text: text.slice(0, MAX_COMPANY_CONTEXT_LENGTH),
            source: selector.startsWith(".jobs-company")
              ? "LinkedIn company panel"
              : "company section on job page",
          };
        }
      } catch {
        // Continue to the next company-context selector.
      }
    }
    return { text: "", source: "none" };
  }

  function isAggregatorJobPage(documentRef) {
    try {
      const host = new URL(documentRef.location?.href ?? "").hostname.toLowerCase();
      return (
        host.endsWith("linkedin.com") ||
        host.endsWith("indeed.com") ||
        host.includes(".indeed.") ||
        host.endsWith("glassdoor.com") ||
        host.includes(".glassdoor.") ||
        host.endsWith("xing.com")
      );
    } catch {
      return false;
    }
  }

  function extractApplicationMethod(documentRef, jobTitle = "") {
    let controls = [];
    try {
      controls = Array.from(
        documentRef.querySelectorAll(selectedJobApplySelector),
      );
    } catch {
      controls = [];
    }

    if (!controls.length && !isAggregatorJobPage(documentRef)) {
      try {
        controls = Array.from(
          documentRef.querySelectorAll("button, a[role='button'], a[href]"),
        );
      } catch {
        controls = [];
      }
    }

    const normalizedTitle = normalizeText(jobTitle).toLocaleLowerCase();
    if (controls.length > 1 && normalizedTitle) {
      const matchingControls = controls.filter((control) => {
        const label = normalizeText(
          [
            control.innerText || control.textContent,
            control.getAttribute?.("aria-label"),
            control.getAttribute?.("title"),
          ]
            .filter(Boolean)
            .join(" "),
        ).toLocaleLowerCase();
        return label.includes(normalizedTitle);
      });
      if (matchingControls.length) controls = matchingControls;
    }

    let externalCandidate = null;
    for (const control of controls) {
      if (!isElementVisible(control, documentRef)) continue;
      const visibleText = normalizeText(control.innerText || control.textContent);
      const ariaLabel = normalizeText(control.getAttribute?.("aria-label"));
      const title = normalizeText(control.getAttribute?.("title"));
      const label = visibleText || ariaLabel || title;
      const searchableLabel = [visibleText, ariaLabel, title]
        .filter(Boolean)
        .join(" ");

      if (easyApplyPattern.test(searchableLabel)) {
        return {
          method: "easy_apply",
          label: label || "Easy Apply",
          confidence: "high",
        };
      }

      if (!externalCandidate && externalApplyPattern.test(searchableLabel)) {
        externalCandidate = {
          method: "external_apply",
          label: label || "Apply",
          confidence: "medium",
        };
      }
    }

    return (
      externalCandidate || {
        method: "unknown",
        label: "Application method not detected",
        confidence: "low",
      }
    );
  }

  function findClosedApplicationEvidence(value) {
    const match = normalizeText(value).match(closedApplicationPattern);
    return normalizeText(match?.[0]);
  }

  function extractApplicationStatus(
    documentRef,
    description = "",
    validThrough = "",
  ) {
    let evidence = findClosedApplicationEvidence(description);

    if (!evidence) {
      try {
        for (const element of documentRef.querySelectorAll(selectedJobStatusSelector)) {
          if (!isElementVisible(element, documentRef)) continue;
          evidence = findClosedApplicationEvidence(
            element.innerText || element.textContent,
          );
          if (evidence) break;
        }
      } catch {
        // A missing site-specific status region is ordinary, not an error.
      }
    }

    if (!evidence && validThrough) {
      const deadline = Date.parse(validThrough);
      if (Number.isFinite(deadline) && deadline < Date.now()) {
        evidence = `Application deadline passed: ${validThrough}`;
      }
    }

    return evidence
      ? { status: "closed", statusLabel: evidence, statusConfidence: "high" }
      : {
          status: "unknown",
          statusLabel: "Application availability not determined",
          statusConfidence: "low",
        };
  }

  function countDescriptionSignals(description) {
    return descriptionSignalPatterns.reduce(
      (count, pattern) => count + Number(pattern.test(description)),
      0,
    );
  }

  function scoreDetection({
    hasStructuredJob = false,
    hasSpecificContainer = false,
    pageTitle = "",
    pageUrl = "",
    description = "",
  }) {
    let score = 0;
    const signals = [];

    if (hasStructuredJob) {
      score += 70;
      signals.push("JobPosting structured data");
    }

    if (hasSpecificContainer) {
      score += 35;
      signals.push("job-description container");
    }

    if (jobPagePattern.test(pageTitle)) {
      score += 15;
      signals.push("job-related page title");
    }

    if (jobPagePattern.test(pageUrl.replace(/[\/_-]+/g, " "))) {
      score += 15;
      signals.push("job-related page URL");
    }

    if (isKnownJobPageUrl(pageUrl)) {
      score += 25;
      signals.push("recognized job-site posting URL");
    }

    if (description.length >= 500) {
      score += 10;
      signals.push("substantial description text");
    }

    const descriptionSignals = countDescriptionSignals(description);
    if (descriptionSignals > 0) {
      score += Math.min(descriptionSignals * 6, 24);
      signals.push(`${descriptionSignals} job-description text signal${descriptionSignals === 1 ? "" : "s"}`);
    }

    return {
      score: Math.min(Math.round(score), 100),
      signals,
    };
  }

  function selectDescription(structuredJob, candidates) {
    const visibleCandidate = candidates[0] ?? null;
    const structuredDescription = structuredJob?.description ?? "";

    if (
      structuredDescription.length >= MIN_DESCRIPTION_LENGTH &&
      (!visibleCandidate || structuredDescription.length >= visibleCandidate.text.length * 0.75)
    ) {
      return {
        text: structuredDescription,
        source: "JobPosting structured data",
        isSpecific: true,
      };
    }

    if (visibleCandidate) {
      return visibleCandidate;
    }

    return { text: "", source: "none", isSpecific: false };
  }

  function extract(documentRef) {
    const structuredJob = extractStructuredJob(documentRef);
    const candidates = collectDescriptionCandidates(documentRef);
    const selected = selectDescription(structuredJob, candidates);
    const originalLength = selected.text.length;
    const description = selected.text.slice(0, MAX_DESCRIPTION_LENGTH);
    const pageTitle = normalizeText(documentRef.title);
    const pageUrl = String(documentRef.location?.href ?? "");
    const detection = scoreDetection({
      hasStructuredJob: Boolean(structuredJob),
      hasSpecificContainer: selected.isSpecific,
      pageTitle,
      pageUrl,
      description,
    });

    const title =
      structuredJob?.title || getFirstText(documentRef, titleSelectors) || pageTitle;
    const application = {
      ...extractApplicationMethod(documentRef, title),
      ...extractApplicationStatus(
        documentRef,
        description,
        structuredJob?.validThrough,
      ),
    };
    const company =
      structuredJob?.company || getFirstText(documentRef, companySelectors);
    const visibleCompanyContext = extractVisibleCompanyContext(documentRef);
    const companyContext =
      structuredJob?.companyContext || visibleCompanyContext.text;
    const companyEvidenceSource = structuredJob?.companyContext
      ? "JobPosting structured data"
      : visibleCompanyContext.source;

    return {
      schemaVersion: 2,
      isLikelyJobPosting: detection.score >= 50,
      detection,
      job: {
        title,
        company,
        companyContext,
        companyEvidenceSource,
        location: structuredJob?.location ?? "",
        description,
        application,
      },
      extraction: {
        source: selected.source,
        characterCount: description.length,
        completeness:
          description.length >= 1000
            ? "high"
            : description.length >= 400
              ? "medium"
              : "low",
        wasTruncated: originalLength > MAX_DESCRIPTION_LENGTH,
      },
      page: {
        title: pageTitle,
        url: pageUrl,
      },
    };
  }

  const api = Object.freeze({
    extract,
    extractApplicationMethod,
    extractApplicationStatus,
    findJobPostingNode,
    getStructuredCompanyContext,
    isKnownJobPageUrl,
    normalizeText,
    scoreDetection,
  });

  if (typeof globalThis === "object") {
    globalThis.ApplyOrNotExtractor = api;
  }

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
})();
