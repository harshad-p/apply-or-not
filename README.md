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

The job postings were in English, but had either a hard German language requirement, or it was a plus
Still no issue right? I can just read through the job description and figure it out. 
But some job descriptions were in German. So what? Browsers these days can translate the page to your preferred language. Yes. But only if the whole page is in a different language than your preferred language. For some jobs where part of it is in German, I have to painstakingly select partial text and translate it. Sometimes, these description although in German, have an English language requirement, or no preference at all. 
Imagine doing all this repeatedly. Everyday.  

And that's how the idea of Apply or Not was born. Someway I can expedite this decision. 
Only if someone could tell me if the job description fits my criteria. 
Not just the language part, but it could also make it easier if it tells me if I should apply 
or not based upon my skillset. Maybe I enjoy working for companies in the manufacturing domain. 
Maybe I like working across cross-funcional teams directly, etc. 

And it doesn't have to be used by people in Germany. I think if there are people targeting jobs in other countries, and are facing a similar issue, they could use it too. 

Of course, the decision given comes with it's own risk. But I would like to emphasize that it is a decision support, not the final verdict. A pre-analysis to save time. 

So, Apply or Not analyzes the original posting without requiring the user to translate the page first, then presents its summary and reasoning in the user's preferred language. 
It also distinguishes the language used to write the job description from an actual
language requirement: a posting written in German or Japanese does not by itself
mean that proficiency in that language is mandatory.

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
my original Germany-focused need into a tool for applicants everywhere;
separating a posting's language from an actual language requirement; accepting
rambling free-form preferences; treating Easy Apply as structured evidence;
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

Version 0.10 is a submission candidate: the popup extracts the active job, sends it through the
localhost relay to GPT-5.6, validates the response, and displays the score,
recommendation, confidence, evidence, language assessment, and returned model.
The toolbar badge shows the score with a recommendation color.

Successful analyses are cached locally by stable job identity, saved criteria,
explanation language, and prompt version. Dynamic page fragments do not make the
same job look new, so reopening the popup restores the result and keeps the
billable action labeled **Reanalyze this job**.

The extractor also detects visible Easy Apply and external-application controls.
Prompt v6 treats application method as selected-job page-control evidence, recognizes
transferable skills across related technologies, evaluates explicit employer
and industry preferences from posting evidence, and scores only the
preferences the user actually stated. GPT-5.6 classifies fixed rubric dimensions
while trusted application code calculates the final percentage, preventing the
model from freely choosing a different number on reanalysis.

Company evidence is collected conservatively from Schema.org organization and
industry fields, known job-site company-name elements, and recognizable company
panels on the current job page. The evidence source is sent with the extracted
text. Apply or Not does not guess a company's industry from its name or silently
visit external company profiles.

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

For the employer-preference video example, compare the fictional Northstar page
with `http://localhost:4173/fixtures/job-posting-openai-synthetic.html`. The page
is prominently labeled as synthetic and is not a real OpenAI job posting.

Run the dependency-free extractor tests with:

```sh
node --test tests/*.test.*
```

## License

Apply or Not is available under the [MIT License](LICENSE).
