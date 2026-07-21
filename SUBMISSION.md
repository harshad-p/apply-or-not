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

Apply or Not runs as a local-first Safari, Chromium, and Firefox extension. Preferences
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

After the submission, I want to add local LLM support through configurable
OpenAI-compatible endpoints such as Ollama or LM Studio. Other next steps include
more job-site adapters, assistance with untranslated application-form labels,
optional company enrichment with provenance, configurable scoring preferences,
and a privacy-conscious hosted relay with quotas.

## Judge testing instructions

### Requirements

- The no-cost judge demo needs only a supported browser and a local repository
  copy—no Node.js, Python, API key, relay, or network request.
- Live GPT-5.6 analysis additionally needs Node.js 18+, an OpenAI Platform API
  key with available credit, internet access, and local port `8787`.
- The four fictional browser pages use Python 3 as a static server on local port
  `4173`. Python is only for these fixtures, not for real job pages.

1. Load the repository's `extension` directory as a temporary Safari or Firefox
   extension, or as an unpacked Chromium extension.
2. Open the toolbar popup and choose **Run no-cost demo**.
3. Inspect the score, recommendation, evidence, language assessment, Easy Apply
   detection, and toolbar badge. No API key, relay, preferences, or network call
   is required.
4. Optionally run `node --test tests/*.test.*` to execute the offline suite.
5. For a live GPT-5.6 test, run `node local-relay/server.mjs`, connect a key from
   extension settings (or set `OPENAI_API_KEY` before startup), save preferences,
   open a job posting, and choose **Analyze this job**. This optional path is
   billable; the entered key is never saved by the extension.

## Demo video outline — target under 3:00

- **0:00–0:20 — Problem:** Job seekers may encounter long postings written in a
  local language that is not necessarily a job requirement, while also trying
  to identify which listed requirements are genuine blockers.
- **0:20–0:35 — Birth and setup:** Reveal the logo and say the extension was
  built with help from Codex. Show loading it and starting the Node relay.
- **0:35–0:50 — Safe key demonstration:** Show only a prominently labeled fake
  key. Configure the real key off-camera, then show the connected state and
  explain that the relay keeps it only in memory—not browser storage.
- **0:50–1:10 — Preferences and fixtures:** Enter the synthetic applicant
  preferences. Start the Python fixture server and clarify that it is only for
  safe demo pages; real job sites do not require it.
- **1:10–1:55 — Four scenarios:** Analyze the English strong match, German
  strong match, English mismatch, and closed strong match. Emphasize that a
  German posting does not prove German is required, while closed applications
  deterministically score zero.
- **1:55–2:20 — Popup behavior:** Scroll through positive matches, concerns,
  evidence, and language requirements. Close and reopen the popup to show saved
  state, then show the billable reanalysis warning.
- **2:20–2:35 — Judge demo:** Run the no-cost synthetic demo and state that it
  never calls an API.
- **2:35–2:50 — Next steps:** Mention local LLMs, more site adapters, application
  form translation, and optional company enrichment.
- **2:50–3:00 — Close:** Reinforce that this is evidence-based decision support;
  the applicant still makes the final decision.

## Recording checklist

- Keep the video under three minutes and include clear audio.
- Use only bundled synthetic applicant and job data.
- Do not show a real API key. If demonstrating the field, use a visibly labeled
  fake placeholder and configure the real key off-camera.
- Show both the working product and how Codex and GPT-5.6 were used.
- End by emphasizing evidence, uncertainty, and human judgment rather than
  presenting the score as an automatic application decision.
- Upload publicly to YouTube and paste the URL into Devpost.

## Still required from the entrant

- Two or three final screenshots
- Public YouTube URL
- `/feedback` Codex Session ID from the main build task
- Final Devpost form submission
