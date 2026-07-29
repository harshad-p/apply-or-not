const userCriteria = `Match me with these skills: C#, .NET. If Blazor is present, score higher.
I do not have frontend JavaScript Framework knowledge.
Prefer positions where English is the working language or German is optional.
Strongly reduce the score when fluent German, C1, or business-level German is an explicit hard requirement.
Do not infer a strict German requirement merely because the job description is written in German.`;

const preparedUserCriteria = `Skills: C#; .NET
Boosts: Blazor
Penalize: required frontend JavaScript framework; fluent, C1, or business-level German explicitly required
Prefer: English working language; German optional`;

const jobs = [
  {
    id: "linkedin-4443282293",
    url: "https://www.linkedin.com/jobs/view/4443282293/",
    title: "Software Development Engineer - Automation, Fire TV - Berlin",
    company: "Amazon",
    description: `Description

As a Software Development Engineer in the Automation Products team within Fire TV Quality Engineering, you will architect, build, and operate production platforms that power AI-driven quality assurance and automated release readiness across 11+ component teams and 7+ device families. You'll design AI-powered test intelligence systems that analyze code changes and generate executable tests, build automated release scoring platforms with policy-as-code enforcement, and develop data pipelines that unify quality signals into a single layer consumed by engineering leadership. You will own production services end-to-end — from architecture and APIs to SLAs, CI/CD integration, and on-call — partnering directly with feature teams to embed quality into the development lifecycle. This is not a test automation role; it is a platform engineering role that replaces manual quality processes with self-governing systems at org scale.

Key job responsibilities

You will design and deliver scalable platform services that transform how quality is measured, enforced, and communicated across the organization. You'll own the full lifecycle of AI-powered test intelligence systems, build and operate automated release scoring platforms, design real-time data pipelines, integrate platforms into CI/CD workflows, define SLAs, influence technical direction through design reviews, and mentor peers on resilient distributed systems.

About The Team

The Automation Products team within Fire TV Quality Engineering builds the intelligent infrastructure that enables 200+ engineers to ship high-quality software across 7+ device families. We operate at the intersection of platform engineering, AI/ML, and quality assurance.

Basic Qualifications

- Experience leading the architecture and design (architecture, design patterns, reliability and scaling) of new and current systems
- Experience in professional, non-internship software development
- Experience programming with at least one modern language such as Java, C++, or C# including object-oriented design

Preferred Qualifications

- Bachelor's degree in computer science or equivalent
- Experience with full software development life cycle, including coding standards, code reviews, source control management, build processes, testing, and operations

Company - Amazon Development Center Germany GmbH
Job ID: A10485670`,
    fastEvidence: `Role: Software Development Engineer, platform engineering.
Required: architecture, design patterns, reliability, scaling; professional software development; at least one modern language such as Java, C++, or C# with object-oriented design.
Preferred: full SDLC, code reviews, source control, build, testing, operations.
No explicit human-language requirement.`,
    expected: {
      recommendation: ["consider", "apply"],
      minimumScore: 65,
      skillsOutcome: "match",
      languageOutcome: ["unknown"],
      languageRequirementCount: 0,
    },
  },
  {
    id: "linkedin-4444117074",
    url: "https://www.linkedin.com/jobs/view/4444117074/",
    title: "Softwareentwickler / Anwendungsentwickler (gn)",
    company: "Remmert GmbH",
    description: `Remmert ist spezialisiert auf automatisierte Lager- und Logistiksysteme. Wir wissen, wie man Bleche, Langgüter und Werkstücke platzsparend lagert und vollautomatisch bewegt.

Als Softwareentwickler (gn) unterstützt du bei der Neuentwicklung unserer Warehouse-Management-Software.

Aufgaben

- Softwareentwicklung in C# / .Net (Full Stack)
- Konzeption und Entwicklung neuer Produkte und Lösungen
- Technische Dokumentation der Software
- Aktive Mitarbeit an der technischen Architektur und Konzeption neuer Features

Qualifikation

- Ausbildung als Fachinformatiker für Anwendungsentwicklung (gn) oder ein vergleichbarer Abschluss
- Fundierte Erfahrung in der C#-Entwicklung
- Erfahrungen mit Blazor und Entity Framework Core wünschenswert
- Verständnis für sauberen Code, moderne Softwarearchitekturen und Design Patterns
- Sehr gute Deutschkenntnisse in Wort und Schrift
- Gute Englischkenntnisse

Benefits

- Unbefristeter Arbeitsvertrag mit 30 Tagen Urlaub
- Mobiles Arbeiten (Hybrid) und flexible Arbeitszeiten
- Entwicklungsperspektiven und Förderung von Weiterbildungen`,
    fastEvidence: `Role: Softwareentwickler, Warehouse-Management-Software.
Tasks: C# / .NET full stack; architecture and feature design.
Required: strong C# experience; clean code, modern architecture, design patterns; very good written and spoken German; good English.
Preferred: Blazor and Entity Framework Core.
Work: hybrid.`,
    expected: {
      recommendation: ["consider"],
      minimumScore: 65,
      maximumScore: 79,
      skillsOutcome: "match",
      languageOutcome: ["conflict"],
      requiredLanguages: ["German", "English"],
    },
  },
];

export { jobs, preparedUserCriteria, userCriteria };
