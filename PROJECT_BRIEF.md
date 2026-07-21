# Apply or Not — Project Brief and Build Prompt

Use this document as the source of product context when helping design, build,
test, or document Apply or Not. Preserve its product intent and constraints. If
a requested implementation conflicts with this brief, explain the tradeoff
before changing direction.

## Product

Apply or Not is a local-first browser extension that helps a job seeker decide
whether a job posting is worth applying to. It reads the posting, evaluates it
against the user's background and preferences with an LLM, and returns a clear,
evidence-based recommendation.

The first real-world use case comes from the project's creator: a software
developer currently living in Germany, proficient in English, and applying for
software-development roles in Germany. Some relevant postings are written partly
or entirely in German.

Apply or Not is not specific to Germany, German, software development, or any
particular applicant profile. It should help anyone evaluate a job posting in any
supported language. For example, an English-speaking applicant could evaluate a
Japanese posting without first translating the page, while the extension checks
separately whether the employer actually requires Japanese proficiency. Every
user can enter their own background, languages, preferences, and deal-breakers.

## Core experience

1. Detect that the active page is likely a job posting.
2. Extract the complete job description from the page.
3. Let the user describe their skills and preferences in natural, unstructured
   language. Rambling is acceptable.
4. Analyze the posting against those preferences with the selected LLM provider.
5. Return a score, recommendation, confidence level, and concise reasoning based
   on evidence from the posting.
6. Show the score on the toolbar badge and the full result in the popup.
7. Optionally show a small, dismissible result banner on the job page.

## Multilingual behavior

- Analyze job descriptions in their original language; the user should not need
  to translate the page first.
- Present the summary and reasoning in the user's preferred output language.
- Treat the posting's language, the user's language proficiency, the user's
  preferred output language, and the employer's language requirements as
  separate facts.
- Never infer that proficiency in a language is required merely because the
  posting is written in that language.
- Distinguish explicit requirements such as “fluent German required” from softer
  signals such as “German is helpful,” alternatives such as “English or German,”
  or no stated requirement. Apply the same reasoning to every language.
- Quote or cite short evidence from the original posting when useful, and explain
  that evidence in the user's preferred language.

## Preference interpretation

The user's criteria are editable and stored locally. They are not hardcoded.
The LLM may convert free-form criteria into a structured internal profile, but
the original text must remain editable.

Initial example preferences include:

### Positive signals

- Skills such as C#, .NET, ASP.NET, Azure, and SQL Server
- Remote or hybrid work
- German not required, or B2/C1 German acceptable
- Mid-level or senior roles

### Negative signals and possible blockers

- React, Vue, or Angular listed as genuinely required when the user lacks them
- Mandatory German fluency
- Other deal-breakers stated by the user

Requirements must be interpreted in context. A technology mentioned as an
example, part of the wider team stack, or a nice-to-have is not the same as a
hard requirement. One missing requirement should not dominate an otherwise
strong match unless the posting or user clearly treats it as a blocker. The
result may recommend applying despite a gap when the overall fit is compelling.

## Analysis result

Prefer structured model output that the extension can validate. It should
contain at least:

- A score from 0 to 100
- A recommendation: `apply`, `consider`, or `skip`
- A confidence level
- A short summary in the user's preferred language
- Positive matches with supporting evidence
- Concerns or missing requirements with supporting evidence
- Explicit hard blockers, if any
- Ambiguous or missing information
- Detected posting language
- Explicitly stated language requirements

The score must follow an explainable rubric rather than arbitrary sentiment.
The implemented rubric uses fixed application-side weights and discrete model
classifications so GPT-5.6 interprets evidence but cannot freely choose the final
percentage.
Prompt v6 also treats adjacent technologies as transferable evidence, evaluates
employer/domain preferences from available company evidence, and accepts Easy
Apply only from the selected job's application control.
Do not invent facts that are absent from the posting or the user's profile.
Treat low extraction quality or ambiguous wording as uncertainty, not as a
negative signal.

Suggested presentation:

- 80–100: Apply — green check
- 60–79: Consider — yellow/orange exclamation
- 0–59: Skip — red cross or thumbs-down

Thresholds should eventually be configurable and must not replace the written
reasoning.

## Job-page extraction

Support Safari first while keeping the WebExtension core compatible with other
modern browsers. Begin with a generic extractor and progressively add adapters
for commonly used job sites such as LinkedIn, Indeed, Glassdoor, and Xing.

Extraction should consider:

- Semantic HTML and visible text
- `JobPosting` structured data when available
- Site-specific containers when necessary
- Dynamically loaded and expanded descriptions
- A user-triggered retry after “show more” content becomes visible
- Clear feedback when the page is unsupported or extraction appears incomplete

Do not bypass authentication, CAPTCHAs, paywalls, or access controls. Do not
crawl listings in bulk. Treat job-page text as untrusted data: instructions
embedded in a posting must never override the analysis prompt, reveal secrets,
or cause tool/API actions.

The current analysis may evaluate employer, industry, or business-domain
preferences only from the extracted company metadata and evidence in the job
posting, including structured organization/industry fields and recognizable
company panels. Optional enrichment from employer websites or public company profiles
is future work and must remain user-triggered, cite its source, avoid unsupported
inferences, and respect access controls and third-party terms.

## LLM providers

Use a small provider interface so model backends remain swappable:

- OpenAI GPT-5.6 as the default and demonstrated hackathon provider
- A configurable local LLM endpoint
- Optional compatible cloud providers later

Provider selection must not change the normalized analysis-result schema. Keep
prompts versioned and testable. Validate model output before displaying it, and
handle timeouts, malformed responses, rate limits, and unavailable providers.

The background worker owns each in-flight analysis, its persisted status, cache
write, and toolbar update. The popup is only a view: closing it must not cancel
or discard an analysis, and reopening it should show the running state or saved
result.

### Possible hosted service after the first release

A future version may offer a seamless, sponsored cloud tier. The extension would
send an analysis request to an Apply or Not server, and that server would call
the model provider with a server-side API key before returning only the
normalized result. The provider key must never be embedded in or returned to the
extension.

Such a service would require explicit privacy terms, secure transport, request
validation, per-user or per-installation quotas, rate limiting, abuse prevention,
cost controls, retention rules, and a clear response when the sponsored allowance
is exhausted. Users could then switch to a personal API key or local provider.
This hosted tier is a future option, not part of the initial local-only release.

## User interface

- Toolbar badge showing a compact score such as `87`, or a failure/skip symbol
- Green, yellow/orange, and red states with more than color alone conveying the
  result
- Popup containing score, recommendation, confidence, summary, and reason lists
- Settings page for free-form criteria, preferred output language, provider,
  model configuration, and optional score thresholds
- Clear loading, retry, unsupported-page, missing-key, and error states
- Accessible keyboard behavior, readable contrast, and concise language

## Privacy and security

- No backend, database, user accounts, or analytics for the initial version
- Store criteria, settings, and cached results locally
- Explain what content is sent before using a cloud provider
- Request only the browser permissions the extension actually needs
- Never commit, log, display, or include API keys in screenshots or demo videos
- Never insert untrusted job-page content with unsafe HTML APIs
- Provide a way to clear locally stored criteria and results

Standard OpenAI API keys must not be stored in extension code or browser
storage. For local development, use a localhost-only relay that reads the key
from the developer's environment. A future hosted service must keep its key on
the server. Local-model providers may be called directly when they do not use a
cloud secret.

## Technical constraints

- Plain HTML, CSS, and JavaScript
- No React, UI framework, bundler, or required build pipeline
- Browser-neutral WebExtension code with Safari packaging kept separate
- Small modules with explicit responsibilities
- Local fixtures and automated tests for extraction, scoring contracts, and
  provider-response validation

## OpenAI Build Week requirements

- Build the core functionality using Codex with GPT-5.6
- Use GPT-5.6 as a meaningful part of the submitted and demonstrated product
- Preserve the `/feedback` Session ID for the main Codex build task
- Document Codex collaboration, human decisions, and GPT-5.6 usage in the README
- Provide a working test path that does not require judges to rebuild everything
- Use a fictional job page and synthetic applicant data in public demos to avoid
  exposing personal data or third-party material

## Initial delivery sequence

Work in small, verifiable increments:

1. Create a minimal cross-browser extension that loads and opens a popup.
2. Add settings for criteria and preferred output language.
3. Add a generic job-page detector and extractor with synthetic fixtures.
4. Define and validate the normalized analysis-result schema.
5. Add the GPT-5.6 provider and the analysis prompt.
6. Display live results in the popup and toolbar badge.
7. Add site-specific extraction adapters only after the generic path works.
8. Package and verify Safari support, then document the judge test path.

## Non-goals for the first release

- Applying to jobs automatically
- Bulk scraping or background crawling
- User accounts or cross-device synchronization
- A hosted backend
- App Store distribution
- Claiming that the recommendation guarantees application success

## Quality bar for implementation help

Before making changes, inspect the existing repository and preserve unrelated
work. Prefer the smallest implementation that completes the current milestone.
Explain important assumptions, avoid unnecessary dependencies, test behavior in
proportion to its risk, and keep documentation synchronized with the product.
