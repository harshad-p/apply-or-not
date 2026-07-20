# Apply or Not — Submission Package

## Repository

https://github.com/harshad-p/apply-or-not

## Recommended category

**Apps for Your Life**

## Tagline

To apply or not—that is the question.

**One-line description:** Turn any job posting into an evidence-based apply,
consider, or skip decision.

## Devpost description

Job seekers waste time translating postings, deciphering vague requirements,
and deciding whether one missing skill should stop them from applying. Apply or
Not is a local-first Safari and Chromium extension that reads the active job
posting and evaluates it against the applicant's own free-form preferences.

Users can describe their experience, languages, working-style preferences, and
deal-breakers naturally. GPT-5.6 Sol classifies each stated criterion and returns
confidence, concise reasoning, evidence, and explicit language requirements. The
extension calculates a reproducible score from 0–100 and an Apply/Consider/Skip
recommendation using fixed, documented weights.
The posting can be German, Japanese, or another language; the extension does not
mistake the language of the page for a mandatory applicant qualification.

The extension combines generic visible-text extraction, Schema.org JobPosting
data, and site-specific heuristics. It detects application controls such as Easy
Apply, shows a score badge in the toolbar, caches exact matching results locally,
and warns before a reanalysis creates another billable request. A localhost-only
relay protects the OpenAI API key and sends strict, non-stored Responses API
requests. A clearly labeled synthetic judge demo exercises the complete result
UI without an API key or charge.

Apply or Not was built incrementally with Codex using GPT-5.6 Sol. Codex helped
implement extraction, prompt and schema design, the OpenAI relay, Safari UI,
caching, tests, and submission packaging. Human decisions shaped the product's
multilingual behavior, privacy boundaries, scoring principles, and user
experience throughout development.

## Judge testing instructions

1. Load the repository's `extension` directory as a temporary Safari extension
   or an unpacked Chromium extension.
2. Open the toolbar popup and choose **Run no-cost demo**.
3. Inspect the score, recommendation, evidence, language assessment, Easy Apply
   detection, and toolbar badge. No API key, relay, preferences, or network call
   is required.
4. Optionally run `node --test tests/*.test.*` to execute the offline suite.
5. For a live GPT-5.6 test, run `node local-relay/server.mjs`, connect a key from
   extension settings (or set `OPENAI_API_KEY` before startup), save preferences,
   open a job posting, and choose **Analyze this job**. This optional path is
   billable; the entered key is never saved by the extension.

## Demo video outline — target 2:30

- **0:00–0:20 — Problem:** Job seekers face long or foreign-language postings
  and cannot tell which listed requirements are genuine blockers.
- **0:20–0:40 — Preferences:** Show the settings page and enter a synthetic,
  conversational applicant profile rather than a keyword checklist.
- **0:40–1:05 — Extraction:** Open the bundled synthetic job page. Show job
  detection, Schema.org/visible-text extraction, and Easy Apply recognition.
- **1:05–1:35 — GPT-5.6 result:** Run live analysis. Show the score badge,
  recommendation, evidence, and how German being optional is separated from the
  English working-language requirement.
- **1:35–1:50 — Cost and privacy:** Reopen the cached result, show the billable
  reanalysis warning, and briefly show the localhost relay with no key visible.
- **1:50–2:10 — Judge demo:** Run the no-cost synthetic demo and point out its
  explicit labeling.
- **2:10–2:25 — Codex:** Show the commit history/tests and explain that Codex
  helped build and debug the extension iteratively with GPT-5.6 Sol.
- **2:25–2:30 — Close:** “Apply or Not helps you spend application time where
  the evidence says it matters.”

## Recording checklist

- Keep the video under three minutes and include clear audio.
- Use only bundled synthetic applicant and job data.
- Do not show API keys, personal information, real job pages, copyrighted music,
  or third-party trademarks.
- Show both the working product and how Codex and GPT-5.6 were used.
- Upload publicly to YouTube and paste the URL into Devpost.

## Still required from the entrant

- Two or three final screenshots
- Public YouTube URL
- `/feedback` Codex Session ID from the main build task
- Final Devpost form submission
