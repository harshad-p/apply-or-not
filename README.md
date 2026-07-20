# Apply or Not

<p align="center">
  <img src="extension/icons/icon-256.png" width="128" alt="Apply or Not logo: an application button being pressed by a cursor">
</p>

<p align="center"><em>To apply or not—that is the question.</em></p>

Apply or Not is a local-first browser extension that helps job seekers decide
whether a job posting is worth applying to. It extracts the visible job
description, evaluates it against the user's free-form preferences with an LLM,
and returns an evidence-based score and recommendation.

It can happen that a relevant job posting is written in the local language
rather than the applicant's preferred language. Apply or Not analyzes the
original posting without requiring the user to translate the page first, then
presents its summary and reasoning in the user's preferred language. It also
distinguishes the language used to write the job description from an actual
language requirement: a posting written in German or Japanese does not by itself
mean that proficiency in that language is mandatory.

The project began with a concrete personal need: its creator is an
English-speaking software developer currently living in Germany and evaluating
local software-development postings, including jobs written in German where
German proficiency may not actually be required. That initial use case shaped
the multilingual behavior, but the extension was generalized for applicants,
countries, professions, and languages everywhere.

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

The extension stores settings and cached results locally. Live analysis sends
the extracted job description and user criteria through the localhost relay to
OpenAI. The key can come from the developer's environment or be sent once from
the settings page to relay memory. It is never stored in extension code or
browser storage. OpenAI requests use `store: false`.

## OpenAI Build Week

This project was built for OpenAI Build Week using Codex with GPT-5.6 Sol. The
submitted product also uses GPT-5.6 Sol as its live job-analysis engine through
the OpenAI Responses API.

### How Codex contributed

The project was developed as one continuous, incremental Codex collaboration.
Codex helped turn the initial product description into a browser-neutral
WebExtension, implement and debug generic, Schema.org, and LinkedIn-shaped job
extraction, design the versioned structured prompt and response contract, build
the secure localhost relay, and connect live results to the popup and toolbar
badge. It also added fixtures and regression tests after each milestone, then
helped diagnose real Safari and LinkedIn behavior reported during hands-on use.

Codex accelerated repetitive implementation, cross-file changes, test creation,
and debugging. The human product decisions remained central: expanding the
creator's original Germany-focused need into a tool for applicants everywhere;
separating a posting's language from an actual language requirement; accepting
rambling free-form preferences; treating Easy Apply as structured evidence;
keeping API keys outside the extension; and adding caching, billing
confirmation, a no-cost judge demo, and the final visual identity in response to
real usage.

### How GPT-5.6 contributes

GPT-5.6 Sol performs the core contextual judgment that keyword matching cannot:
it distinguishes requirements from examples and nice-to-haves, reasons across
multilingual postings, evaluates explicit language requirements separately from
the posting language, and produces validated structured evidence for the score.
The relay requests strict JSON-schema output, disables response storage, and
returns trusted provider metadata so the demonstrated model and response can be
verified. The bundled judge demo is deliberately labeled and deterministic; it
does not pretend to be a live model call.

## Status

Version 0.10 is a submission candidate: the popup extracts the active job, sends it through the
localhost relay to GPT-5.6, validates the response, and displays the score,
recommendation, confidence, evidence, language assessment, and returned model.
The toolbar badge shows the score with a recommendation color.

The extractor also detects visible Easy Apply and external-application controls.
Prompt v4 treats application method as structured evidence, recognizes
transferable skills across related technologies, and scores only the
preferences the user actually stated. GPT-5.6 classifies fixed rubric dimensions
while trusted application code calculates the final percentage, preventing the
model from freely choosing a different number on reanalysis.

Validated results are cached locally for up to 30 days and reused only when the
job URL, extracted content, application method, preferences, explanation
language, and prompt version still match. Reanalysis shows an explicit in-popup
confirmation because it creates another billable model request. The popup uses
one dedicated results scroller so long explanations remain responsive in Safari.
The Apply click identity is installed across the toolbar, popup, settings page,
README, and submission artwork.

The detailed product requirements and build context are maintained in
[PROJECT_BRIEF.md](PROJECT_BRIEF.md).
The remaining submission and product work is tracked in [TODO.md](TODO.md).
Copy-ready submission text and the demo-video outline are in
[SUBMISSION.md](SUBMISSION.md).

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

Use Node.js 18 or newer. Start the relay without putting a key in this
repository:

```sh
node local-relay/server.mjs
```

Open the extension settings, paste the key into **OpenAI API key**, and choose
**Connect key**. The value is sent only to `127.0.0.1`, held in process memory,
and forgotten when the relay stops. It is never written to browser storage.

Alternatively, configure the process from the terminal before starting it:

```sh
export OPENAI_API_KEY="your OpenAI Platform API key"
node local-relay/server.mjs
```

The relay listens only on `127.0.0.1`, accepts browser-extension origins, and
keeps the key only in the local process. Stop it with `Control-C`.

To make one real, billable GPT-5.6 request with fictional data, keep the relay
running and use another terminal:

```sh
node scripts/live-smoke-test.mjs
```

The smoke test prints the score, recommendation, returned model name, and OpenAI
response ID. Normal automated tests never call OpenAI and do not require a key.
Transient 5xx provider failures are retried once. If the retry fails, the relay
preserves the OpenAI request ID when available for troubleshooting.

## No-cost judge demo

The fastest test path does not require an API key, local relay, preferences, or
active job posting:

1. Load the extension in Safari or Chrome using the instructions above.
2. Open its toolbar popup.
3. Choose **Run no-cost demo**.

The popup displays a deterministic result made from bundled synthetic applicant
and job data, including the score, evidence, language assessment, application
method, and toolbar badge. It is prominently labeled **Judge demo** and **Demo
fixture** and never calls an API. This mode exists only to provide free,
repeatable judging access; the live product path uses GPT-5.6 through the local
relay described above.

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

## License

Apply or Not is available under the [MIT License](LICENSE).
