(() => {
  "use strict";

  const extraction = Object.freeze({
    page: {
      url: "https://example.invalid/jobs/senior-backend-developer",
      title: "Senior Backend Developer — Northstar Systems",
    },
    isLikelyJobPosting: true,
    detection: {
      score: 100,
      signals: ["Synthetic judge-demo fixture"],
    },
    extraction: {
      source: "bundled synthetic fixture",
      characterCount: 612,
      wasTruncated: false,
    },
    job: {
      title: "Senior Backend Developer",
      company: "Northstar Systems",
      location: "Berlin · Hybrid",
      description:
        "Build backend services with C#, ASP.NET Core, Azure, and SQL Server. The role is hybrid, Easy Apply is available, English is the working language, and German is helpful but not required.",
      application: {
        method: "easy_apply",
        label: "Easy Apply",
        confidence: "high",
      },
    },
  });

  const modelOutput = Object.freeze({
    score: 94,
    recommendation: "apply",
    confidence: "high",
    summary:
      "This synthetic role strongly matches the sample applicant's backend stack, hybrid-work preference, Easy Apply requirement, and English-language needs.",
    positiveMatches: [
      {
        title: "Backend stack matches",
        explanation:
          "The role directly uses the sample applicant's preferred backend technologies.",
        evidence: "C#, ASP.NET Core, Azure, and SQL Server",
      },
      {
        title: "Hybrid work available",
        explanation: "The stated working arrangement matches the sample preference.",
        evidence: "The role is hybrid",
      },
      {
        title: "Easy Apply available",
        explanation: "The structured application method satisfies the sample requirement.",
        evidence: "Easy Apply",
      },
      {
        title: "German is optional",
        explanation:
          "The posting is compatible with an English-speaking applicant who does not require German.",
        evidence: "German is helpful but not required",
      },
    ],
    concerns: [],
    hardBlockers: [],
    uncertainties: [],
    postingLanguage: "English",
    languageRequirements: [
      {
        language: "English",
        level: "working language",
        requirement: "required",
        evidence: "English is the working language",
      },
      {
        language: "German",
        level: "not specified",
        requirement: "preferred",
        evidence: "German is helpful but not required",
      },
    ],
  });

  function createDemoResult() {
    const analysis = globalThis.ApplyOrNotAnalysis.normalizeAnalysis(
      modelOutput,
      {
        id: "demo",
        model: "demo-fixture",
        responseId: "local-synthetic-demo",
      },
    );
    return { extraction, analysis };
  }

  const api = Object.freeze({ createDemoResult, extraction, modelOutput });

  globalThis.ApplyOrNotDemo = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})();
