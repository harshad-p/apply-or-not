# Apply or Not — TODO

## Submission-critical

- [x] Create the visual identity: the Apply click logo, extension icons for
  Safari and Chromium, and a larger project image for the README and Devpost
  listing. Wire the icon sizes into the manifest.
- [ ] Capture polished screenshots after the branding and final popup states are
  complete, using only synthetic job and applicant data.
- [x] Add a judge demo mode using synthetic applicant and job data so the full
  extension experience can be tested without an API key or billable request.
- [x] Document the shortest judge test path for Safari, Chromium, and Firefox.
- [x] Expand the README with the Codex collaboration story, including what
  Codex accelerated, the important human decisions, and how GPT-5.6 is used in
  the shipped product.
- [x] Publish the repository with an MIT license.
- [ ] Record a public YouTube demo under three minutes with audio, using only
  synthetic job and applicant data. Show the product, Codex collaboration, and
  live GPT-5.6 usage.
- [ ] Capture the `/feedback` Codex Session ID for the task where most core
  functionality was built.
- [ ] Run final Chrome and Safari installation tests from a clean checkout.
- [ ] Complete the Devpost description, category, repository URL, video URL,
  testing instructions, and Session ID, then submit before the deadline.

## Product quality

- [x] Make scores reproducible for unchanged inputs. Use an explicit weighted
  rubric for user criteria and job evidence, keep GPT-5.6 responsible for
  contextual interpretation and explanation, and add regression tests that
  prevent large score changes when the evidence is unchanged.
- [ ] Add dedicated extraction adapters for Indeed, Glassdoor, and Xing as real
  pages expose gaps in the generic extractor.
- [x] Add a configurable local-model provider. Start with a localhost-only,
  OpenAI-compatible endpoint for Ollama or LM Studio; preserve the normalized
  result schema, deterministic scoring, timeout handling, and provider label.
- [x] Add Groq as the default free-tier provider. Server-side key in relay;
  full analysis contract (no compact prompt needed); no translation step.
- [x] Add custom-server reference implementation. Users run their own model
  server; extension sends payload; server returns normalized schema.
- [ ] Add optional, user-triggered company enrichment from an employer website
  or public company profile. Keep company evidence separate from job evidence,
  show provenance and confidence, request only necessary host access, and avoid
  background crawling or unsupported industry/culture inferences.
- [ ] Help users understand dynamically generated application forms whose UI
  language differs from the job posting. Explore visible label/instruction
  extraction and translation, including explicitly permitted cross-origin
  frames, without filling or submitting the application automatically.
- [ ] Consider an optional, privacy-conscious hosted relay with quotas and
  abuse controls after the local release.

## Provider restructure (feature/provider-restructure)

- [x] Move expandLocalAnalysis and helpers into analysis-contract.js
- [x] Add groq-provider.mjs (full contract, GROQ_API_KEY from env)
- [x] Update server.mjs — Groq default, OpenAI with user key, /health reports both
- [x] Update configuration.mjs — free/openai/local providers, Groq key validation
- [x] Build custom-server/ reference implementation
- [x] Update service-worker.js routing (free/openai → relay, custom → user URL)
- [x] Update extension options UI (Free / OpenAI / Custom server)
- [ ] Add GROQ_API_KEY to launchd plist template so it is set on server startup
- [ ] Add custom-server to launchd or provide a startup script
- [ ] Write a groq-provider test (mock fetch, verify full contract request/response)
- [ ] Update README to document the new provider model and custom server setup
