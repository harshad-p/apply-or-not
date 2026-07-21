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
- [ ] Add a configurable local-model provider. Start with a localhost-only,
  OpenAI-compatible endpoint for Ollama or LM Studio; preserve the normalized
  result schema, deterministic scoring, timeout handling, and provider label.
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
