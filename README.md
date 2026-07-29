# Apply or Not

<p align="center">
  <img src="extension/icons/icon-256.png" width="128" alt="Apply or Not logo: an application button being pressed by a cursor">
</p>

<p align="center"><em>To apply or not—that is the question.</em></p>

Apply or Not is a local-first browser extension that helps job seekers decide
whether a job posting is worth applying to. It extracts the visible job
description, evaluates it against the user's free-form preferences with an LLM,
and returns an evidence-based score and recommendation.

So here's what happened. Throughout my 8 years of experience as Full-Stack .NET Developer, 
I have applied to jobs either through LinkedIn, or other job portals with employers in the USA, 
Ireland, Australia, etc. But recently as part of a next step in my career, 
I moved to Germany, and started targeting Software Development jobs in the German job market.  
That is when I hit a few roadblocks: 

The job postings were in English, but had either a hard German language requirement, or it was a plus.
Still no issue right? I can just read through the job description and figure it out. 
But some job descriptions were in German. So what? Browsers these days can translate the page to your preferred language. Yes. But only if the whole page is in a different language than your preferred language. For some jobs where part of it is in German, I have to painstakingly select partial text and translate it. Sometimes, these descriptions, although in German, have an English language requirement, or no preference at all.
Imagine doing all this repeatedly. Every day.

And that's how the idea of Apply or Not was born. Someway I can expedite this decision. 
Only if someone could tell me if the job description fits my criteria. 
Not just the language part, but it could also make it easier if it tells me if I should apply 
or not based upon my skillset. Maybe I enjoy working for companies in the manufacturing domain. 
Maybe I like working across cross-functional teams directly, etc.

And it doesn't have to be used by people in Germany. I think if there are people targeting jobs in other countries, and are facing a similar issue, they could use it too. 

Of course, the decision given comes with its own risk. But I would like to emphasize that it is a decision support, not the final verdict. A pre-analysis to save time.

So, Apply or Not analyzes the original posting without requiring the user to translate the page first, then presents its summary and reasoning in the user's preferred language. 
It also distinguishes the language used to write the job description from an actual
language requirement: a posting written in German or Japanese does not by itself
mean that proficiency in that language is mandatory.

## Planned first release

- Safari, Chromium, and Firefox support through a browser-neutral WebExtension core
- Job-description extraction from common job sites and generic pages
- Multilingual analysis and results in the user's preferred language
- Separation of a posting's written language from explicit language requirements
- Editable, free-form user criteria
- OpenAI GPT-5.6 analysis with structured results
- Optional local-model analysis through Ollama or LM Studio
- Toolbar score badge, detailed popup, and local-only settings storage
- Plain HTML, CSS, and JavaScript with no framework or bundler

## Privacy

The extension stores settings and cached results locally. The selected provider
determines where analysis goes: OpenAI mode sends the extracted job description
and user criteria through the localhost relay to OpenAI, while local mode sends
them only to an OpenAI-compatible model server on the same computer. The OpenAI
key can come from the developer's environment or be sent once from the settings
page to relay memory. It is never stored in extension code or browser storage.
OpenAI requests use `store: false`.

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
and debugging. The human product decisions remained central: expanding
my original Germany-focused need into a tool for applicants everywhere;
separating a posting's language from an actual language requirement; accepting
rambling free-form preferences; treating Easy Apply as evidence from the
selected job's application control;
keeping API keys outside the extension; and adding caching, billing
confirmation, a no-cost judge demo, and the final visual identity in response to
real usage. 

There were many back and forths with Codex that I had to have. 
For as simple as the logo. But we discussed it as a team, and arrived at an acceptable outcome. 
There were times when I noticed bugs, or abnormalities, or situations where the experience could be made better, and Codex made appropriate changes accordingly. 

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

Version 0.19.0 is post-submission development on the local
`codex/local-llm-support` branch. The submitted version remains 0.16.1 on
`main`. The development version can route analysis through either GPT-5.6 or a
local OpenAI-compatible model, validates both through the same result contract,
and displays the score, recommendation, confidence, evidence, language
assessment, and returned model for GPT-5.6. To reduce CPU inference time, local
analysis displays only the score and a short trusted summary. The toolbar badge
shows the score with a recommendation color.

Successful analyses are cached locally by stable job identity, application
availability, saved criteria, explanation language, prompt version, and selected
provider/model. Dynamic page fragments do not make the same job look new, while
a newly closed listing or provider change invalidates its earlier result.
Reopening the popup restores a valid result and keeps the action labeled
**Reanalyze this job**.

Analysis runs in the extension's background worker rather than the temporary
popup. The user can close the popup, continue reading the job description, and
reopen it to see the in-progress state or the saved result.
The popup receives an immediate start acknowledgement and polls the background
state instead of holding one long Safari message channel open. Completed
results display the measured analysis duration alongside the model and prompt
version.

The extractor also detects visible Easy Apply and external-application controls.
Prompt v17 keeps the v12 alternative-requirement fix and adds a compact,
classification-only path for CPU-bound local models. Trusted code writes the
summary so a small model cannot produce a contradictory or truncated headline.
It treats application method as selected-job page-control evidence, recognizes
transferable skills across related technologies, evaluates explicit employer
and industry preferences from posting evidence, and forces closed listings to
score 0 regardless of technical fit. It scores only the
preferences the user actually stated. GPT-5.6 classifies fixed rubric dimensions
while trusted application code calculates the final percentage, preventing the
model from freely choosing a different number on reanalysis. Version 11 also
reinforces that page evidence cannot make an unstated rubric dimension
applicable and that unknown availability must not be described as open.

Company evidence is collected conservatively from Schema.org organization and
industry fields, known job-site company-name elements, and recognizable company
panels on the current job page. The evidence source is sent with the extracted
text. Apply or Not does not guess a company's industry from its name or silently
visit external company profiles.

Validated results are cached locally for up to 30 days and reused only when the
stable job identity, application availability, preferences, explanation
language, prompt version, and provider still match. Reanalysis shows an explicit
in-popup confirmation; OpenAI mode warns that another request may be billable,
while local mode identifies the selected local model. The popup uses one
dedicated results scroller so long explanations remain responsive in Safari.
The Apply click identity is installed across the toolbar, popup, settings page,
README, and submission artwork.

## Next steps

The submitted version deliberately keeps the live path focused on GPT-5.6.
Post-submission local-model support is implemented on the development branch.
The remaining product steps are:

- Add dedicated extraction adapters for Indeed, Glassdoor, and Xing as real
  layouts expose gaps in the generic extractor.
- Explain and translate visible labels in dynamically generated application
  forms without filling or submitting them automatically.
- Add optional, user-triggered company enrichment with visible source and
  confidence information.
- Explore an optional hosted relay with clear privacy terms, quotas, rate
  limits, and cost controls, while retaining personal-key and local-model paths.
- Make score thresholds and selected weighting preferences configurable without
  weakening the evidence shown beside the score.

The detailed product requirements and build context are maintained in
[PROJECT_BRIEF.md](PROJECT_BRIEF.md).
The remaining submission and product work is tracked in [TODO.md](TODO.md).
Copy-ready submission text and the demo-video outline are in
[SUBMISSION.md](SUBMISSION.md).
The continuation voiceover and recording directions are in
[VIDEO_SCRIPT.md](VIDEO_SCRIPT.md).

## Load the development extension

The extension source is in [`extension`](extension).

### Requirements by test path

- **No-cost judge demo:** a supported browser and a local copy of this
  repository. It needs no API key, Node.js, Python, relay, or internet request.
- **Live GPT-5.6 analysis:** Node.js 18 or newer, an OpenAI Platform API key with
  available API credit, an internet connection, and local port `8787` available.
- **Local-model analysis:** Node.js 18 or newer, `npm install`, local port
  `8787`, and an
  OpenAI-compatible Ollama or LM Studio server running on a loopback address.
  The selected model must support structured JSON output and have enough context
  capacity for the job description and rubric. The first German-to-English
  translation downloads a local quantized model; subsequent runs use its cache.
- **Four fictional video scenarios:** Python 3 only to serve the static pages,
  with local port `4173` available. Python is not needed on real job sites.
- **Offline automated tests:** Node.js 18 or newer; no API key or network call.

### Persistent Safari app on macOS

The Xcode wrapper in
[`safari-app/Apply or Not/Apply or Not.xcodeproj`](safari-app/Apply%20or%20Not/Apply%20or%20Not.xcodeproj)
packages the WebExtension as a macOS app. Unlike Safari's temporary-extension
workflow, a properly signed development build remains installed after Safari
quits.

1. Install and open the full Xcode application.
2. Open the Xcode project above.
3. In Xcode Settings > Accounts, add an Apple ID if no development team is
   available.
4. Select the **Apply or Not** project, then set the same development team under
   Signing & Capabilities for both the **Apply or Not** app and
   **Apply or Not Extension** targets. Leave automatic signing enabled.
5. Choose the **Apply or Not** scheme and select Product > Run.
6. When the containing app opens, enable **Apply or Not** in Safari Settings >
   Extensions and grant page access when Safari requests it.

Check that Xcode shows an Apple Development signing identity or development
team. **Sign to Run Locally** is ad-hoc signing; Safari may still require
**Allow Unsigned Extensions** after each restart when that is the only identity
available.

The Safari extension target references the repository's shared `extension`
directory. Changes to the browser-neutral WebExtension are therefore included
the next time the Xcode app is built; there is no copied extension snapshot to
resynchronize.

### Temporary Safari development extension

1. Open Safari Settings, select Advanced, and enable **Show features for web
   developers**.
2. Open the Developer settings pane and allow unsigned extensions for local
   development.
3. Add a temporary extension and select the repository's `extension` folder.
4. Enable **Apply or Not** in Safari Settings > Extensions.
5. Add its button to the toolbar if Safari does not show it automatically, then
   click it to open the popup.

Safari removes this unsigned temporary installation when Safari quits (and may
also expire it after a limited development period). Use the packaged Xcode
project above when restart persistence matters.

### Chrome or another Chromium browser

1. Open the browser's extensions page.
2. Enable Developer mode.
3. Choose **Load unpacked** and select the repository's `extension` folder.
4. Pin **Apply or Not**, then click its toolbar button.

### Mozilla Firefox

1. Enter `about:debugging` in the address bar.
2. Select **This Firefox**.
3. Choose **Load Temporary Add-on**.
4. Open the repository's `extension` folder and select `manifest.json`.
5. Add **Apply or Not** to the toolbar if Firefox does not show it automatically,
   then click its button.

Firefox removes temporarily loaded extensions when the browser restarts. Return
to `about:debugging` to reload it during local development. These steps follow
Mozilla's [temporary extension instructions](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/).

The extension requests `storage`, `activeTab`, and `scripting`. Page access is
temporary and begins only when the user opens the popup and chooses to read the
current page. It also has access only to the local relay at
`http://127.0.0.1:8787`; the extension cannot send requests directly to arbitrary
internet hosts.

## Start the localhost analysis relay

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

### Use a local model instead of OpenAI

The same relay also supports local OpenAI-compatible
`/v1/chat/completions` servers. No OpenAI API key or internet request is needed
for this mode.

1. Start [Ollama](https://docs.ollama.com/api/openai-compatibility) or
   [LM Studio](https://lmstudio.ai/docs/developer/openai-compat) and load a
   model that supports structured JSON output.
   For the smallest tested model that reliably handled the mixed German and
   English acceptance case:

   ```sh
   ollama pull llama3.2:3b
   ```

2. Install the relay's local translation runtime once:

   ```sh
   npm install
   ```

3. Keep `node local-relay/server.mjs` running. The first local analysis
   downloads the quantized German-to-English OPUS model. It remains in the
   Hugging Face cache for later offline use.
4. Open the extension settings and select
   **Local model · Ollama or LM Studio**.
5. Enter the local server base URL and exact model identifier, then save:
   - Ollama commonly uses `http://127.0.0.1:11434/v1`.
   - LM Studio commonly uses `http://127.0.0.1:1234/v1`.
   - The recommended local configuration uses `llama3.2:3b`.
   - `qwen3:0.6b` remains a faster experimental option, but it did not
     classify the supplied language requirements reliably.
6. Analyze a job normally. The popup identifies the returned local model, and
   the same schema validation and deterministic scoring rules still apply.

Only plain HTTP URLs on `localhost`, `127.0.0.1`, or `::1` are accepted. The
relay rejects remote provider URLs and URLs containing credentials. Very small
local models are faster but less nuanced and may fail to follow the required
schema; in that case, choose a stronger structured-output-capable model. Local requests disable
extended reasoning, limit the job-description input to 9,000 representative
characters, ask the model only for compact rubric classifications, a possible
blocker, and minimal language evidence, and cap structured output at 220 tokens.
Trusted JavaScript calculates the score, writes the short summary, rejects
unsupported blockers, and prevents clearly unstated dimensions from changing
the score. Detailed **Why it fits**, concerns, blockers, and language sections
are not rendered for local results. The local semantic contract explicitly asks the model to scan for
language requirements and distinguish requirements found, confidently none
found, and uncertainty. Before local analysis, a dedicated German-to-English
OPUS model translates the compacted job text. It accepts mixed English/German
input, leaves English passages readable, and avoids loading a second chat model.
Language-related passages are preserved explicitly when a long posting is
compacted so a short qualification in the omitted region is not lost.
Local analysis may still take several
minutes on older hardware; the relay allows up to five minutes before reporting
a timeout. While local analysis is running, the popup provides a **Cancel
analysis** action that sends an explicit cancellation request to the relay and
stops local-model generation. The relay owns the local job and retains its
result temporarily, so a Safari connection or background-worker interruption
does not cancel inference; reopening the popup recovers a running or completed
analysis.

The relay terminal logs each local job's elapsed time, transmitted description
size, and prompt/completion token counts when the provider returns them. These
metrics help distinguish model loading, prompt processing, and output-generation
costs. On the development machine, the focused mixed-language acceptance case
took about 40–56 seconds end to end with `llama3.2:3b` after the translation
model was cached. It identified both required languages and reduced the result
to the consider band. Timing varies by hardware and job length. Smaller models can be
faster but were not reliable enough on this acceptance case, so every result
remains decision support rather than a final decision.
German translation uses a dedicated quantized Marian/OPUS model rather than a
second general-purpose chat model. Other source languages remain the
responsibility of GPT-5.6 or a future translation model.

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

1. Load the extension in Safari, Chrome/Chromium, or Firefox using the instructions above.
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

For recording the video, open
`http://localhost:4173/fixtures/demo-scenarios.html`. It links to four polished,
clearly synthetic scenarios: an English strong match, a German strong match, an
English mismatch, and an otherwise strong match that no longer accepts
applications. One suggested applicant profile works across all four pages and
appears only on the launcher, never inside the descriptions sent to the model.
The closed scenario demonstrates the deterministic availability rule: its final
result is always **0 · Skip**, even when the skills and working arrangement fit.

For the employer-preference video example, compare the fictional Northstar page
with `http://localhost:4173/fixtures/job-posting-openai-synthetic.html`. The page
is prominently labeled as synthetic and is not a real OpenAI job posting.

Run the dependency-free extractor tests with:

```sh
node --test tests/*.test.*
```

## License

Apply or Not is available under the [MIT License](LICENSE).
