# Apply or Not

Apply or Not is a local-first browser extension that helps job seekers decide
whether a job posting is worth applying to. It extracts the visible job
description, evaluates it against the user's free-form preferences with an LLM,
and returns an evidence-based score and recommendation.

Job postings are often written in a language the applicant does not understand.
Apply or Not analyzes the original posting without requiring the user to
translate the page first, then presents its summary and reasoning in the user's
preferred language. It also distinguishes the language used to write the job
description from an actual language requirement: a posting written in German
does not by itself mean that German proficiency is mandatory.

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

Initial project setup. No working extension has been implemented yet.
