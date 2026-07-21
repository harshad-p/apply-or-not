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

I built Apply or Not because I kept running into the same questions while
looking at software jobs in Germany. A posting might be written in German even
when German is not actually required. It might list one technology I do not
know alongside several that I use every day. After reading the whole thing, I
still have to decide whether that gap matters enough to skip the job.

With the extension, I can describe what I want in my own words—even if I ramble.
I can mention my skills, languages, preferred way of working, industries,
companies, and real deal-breakers such as “Easy Apply only.” The extension reads
the current job page, including available company and application information,
and sends that evidence to GPT-5.6 Sol. It then shows an Apply, Consider, or Skip
recommendation, a score, and short reasons tied to the posting.

The score is not meant to make the decision for me. It is a second opinion that
helps me notice genuine blockers, transferable skills, and missing information.
For example, it does not assume that a German or Japanese posting requires that
language, and it does not treat SQL Server and PostgreSQL as completely
unrelated skills. The original problem was personal, but the same idea can help
someone applying in any country or language.

Apply or Not runs as a local-first Safari and Chromium extension. Preferences
and cached results stay in the browser. A localhost relay keeps the API key out
of the extension and sends non-stored, structured requests to OpenAI. The
toolbar shows the score, cached results can be reopened without another API
call, and analysis continues if I close the popup to keep reading. The extension
also warns before a billable reanalysis. There is a
clearly labeled synthetic demo that judges can run without an API key.

I built the project step by step with Codex using GPT-5.6 Sol. Codex helped me
turn the idea into the extension, relay, prompt contract, tests, and demo. I
made the product decisions and tested it on real Safari and LinkedIn behavior;
when something failed or felt misleading, I reported it and we fixed it with a
regression test.

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

- **0:00–0:20 — Problem:** Job seekers may encounter long postings written in a
  local language that is not necessarily a job requirement, while also trying
  to identify which listed requirements are genuine blockers.
- **0:20–0:45 — Preferences and company switch:** Enter matching skills plus
  “I only want to apply to OpenAI.” Analyze the synthetic Northstar role, then
  the clearly labeled synthetic OpenAI variant. Explain that the dramatic score
  change comes from the user's explicit deal-breaker—not an AI judgment that one
  company is better.
- **0:45–1:05 — Extraction:** Open the bundled synthetic job page. Show job
  detection, Schema.org/visible-text extraction, and Easy Apply recognition.
  Use the bundled scenario launcher to switch pages without showing a real job
  listing or personal data.
- **1:05–1:40 — GPT-5.6 result:** Start live analysis, close the popup, and
  continue scrolling the job. Reopen it to show the in-progress or saved result,
  then show the score, evidence, and language assessment.
- **1:40–1:55 — Cost and privacy:** Reopen the cached result, show the billable
  reanalysis warning, and briefly show the localhost relay with no key visible.
- **1:55–2:10 — Judge demo:** Run the no-cost synthetic demo and point out its
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
- Keep the company-switch moment brief; use it as a playful demonstration of
  user control, then emphasize evidence, uncertainty, and human judgment.
- Upload publicly to YouTube and paste the URL into Devpost.

## Still required from the entrant

- Two or three final screenshots
- Public YouTube URL
- `/feedback` Codex Session ID from the main build task
- Final Devpost form submission
