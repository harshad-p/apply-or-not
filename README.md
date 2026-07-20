# Apply or Not

Apply or Not is a local-first browser extension that helps job seekers decide
whether a job posting is worth applying to. It extracts the visible job
description, evaluates it against the user's free-form preferences with an LLM,
and returns an evidence-based score and recommendation.

Job postings are often written in a language the applicant does not understand.
Apply or Not analyzes the original posting without requiring the user to
translate the page first, then presents its summary and reasoning in the user's
preferred language. It also distinguishes the language used to write the job
description from an actual language requirement: a posting written in German or
Japanese does not by itself mean that proficiency in that language is mandatory.

## Planned first release

- Safari support, with a browser-neutral WebExtension core
- Job-description extraction from common job sites and generic pages
- Multilingual analysis and results in the user's preferred language
- Separation of a posting's written language from explicit language requirements
- Editable, free-form user criteria
- OpenAI GPT-5.6 analysis with structured results
- Swappable providers, including an optional local LLM endpoint
- Toolbar score badge, detailed popup, and local-only settings storage
- Plain HTML, CSS, and JavaScript with no framework or bundler

## Privacy

The extension will store settings and results locally. Before cloud analysis, it
will make clear that the extracted job description and user criteria are sent to
the selected model provider. API keys must never be committed to this repository.

## OpenAI Build Week

This project is being built for OpenAI Build Week using Codex with GPT-5.6 Sol.
The README will be expanded during development to document the Codex
collaboration, product decisions, setup instructions, and judging test path.

## Status

Milestone 7 is complete: the popup extracts the active job, sends it through the
localhost relay to GPT-5.6, validates the response, and displays the score,
recommendation, confidence, evidence, language assessment, and returned model.
The toolbar badge shows the score with a recommendation color.

The extractor also detects visible Easy Apply and external-application controls.
Prompt v2 treats application method as structured evidence and scores only the
preferences the user actually stated.

Validated results are cached locally for up to 30 days and reused only when the
job URL, extracted content, application method, preferences, explanation
language, and prompt version still match. Reanalysis shows an explicit in-popup
confirmation because it creates another billable model request. The popup uses
one dedicated results scroller so long explanations remain responsive in Safari.

The detailed product requirements and build context are maintained in
[PROJECT_BRIEF.md](PROJECT_BRIEF.md).

## Load the development extension

The extension source is in [`extension`](extension).

### Safari 27 on macOS

1. Open Safari Settings, select Advanced, and enable **Show features for web
   developers**.
2. Open the Developer settings pane and allow unsigned extensions for local
   development.
3. Add a temporary extension and select the repository's `extension` folder.
4. Enable **Apply or Not** in Safari Settings > Extensions.
5. Add its button to the toolbar if Safari does not show it automatically, then
   click it to open the popup.

### Chrome or another Chromium browser

1. Open the browser's extensions page.
2. Enable Developer mode.
3. Choose **Load unpacked** and select the repository's `extension` folder.
4. Pin **Apply or Not**, then click its toolbar button.

The extension requests `storage`, `activeTab`, and `scripting`. Page access is
temporary and begins only when the user opens the popup and chooses to read the
current page. It also has access only to the local relay at
`http://127.0.0.1:8787`; the extension cannot send requests directly to arbitrary
internet hosts.

## Start the local GPT-5.6 relay

Use Node.js 18 or newer. Set `OPENAI_API_KEY` in your terminal environment, then
start the relay without putting the key in this repository:

```sh
export OPENAI_API_KEY="your OpenAI Platform API key"
node local-relay/server.mjs
```

The relay listens only on `127.0.0.1`, accepts browser-extension origins, and
keeps the key in the local process environment. Stop it with `Control-C`.

To make one real, billable GPT-5.6 request with fictional data, keep the relay
running and use another terminal:

```sh
node scripts/live-smoke-test.mjs
```

The smoke test prints the score, recommendation, returned model name, and OpenAI
response ID. Normal automated tests never call OpenAI and do not require a key.

## Verify the current milestone

1. Reload the temporary or unpacked extension after pulling the latest files.
2. Confirm your preferences are saved.
3. Open a job posting and open the popup. Local extraction checks for a matching
   saved result without calling the model.
4. If Safari asks for page access, allow it for the current use.
5. Choose **Analyze this job** when no saved result exists.
6. Close and reopen the popup, then confirm the same result appears without a
   second API request.

### Synthetic extraction fixtures

The repository includes English and German job postings plus a non-job article
under [`extension/fixtures`](extension/fixtures). To serve them locally:

```sh
python3 -m http.server 4173 --directory extension
```

Open `http://localhost:4173/fixtures/job-posting-en.html`,
`http://localhost:4173/fixtures/job-posting-de.html`, or
`http://localhost:4173/fixtures/job-posting-linkedin-like.html` to test job
extraction. Use `http://localhost:4173/fixtures/not-a-job.html` to verify that an
ordinary article is rejected.

Run the dependency-free extractor tests with:

```sh
node --test tests/*.test.*
```
