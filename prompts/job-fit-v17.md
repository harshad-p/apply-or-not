# Job-fit analysis prompt - v17

The executable prompts and strict JSON Schemas live in
`extension/shared/analysis-contract.js`.

Prompt v17 removes the deterministic German and English grammar rules introduced
in v16. Natural-language interpretation belongs to the LLM; trusted application
code remains responsible for structural validation, evidence validation,
scoring, blocker enforcement, and presentation.

An optional focused helper model receives the job posting and the applicant's
language criteria as separately labeled inputs. It must scan the complete
posting for language proficiency requirements regardless of language or
phrasing, preserve job-only evidence, and classify the language fit. It returns:

- `found` with the interpreted requirements and original-language evidence;
- `none` only when it confidently finds no explicit language requirement;
- `uncertain` when the language evidence is ambiguous or the model cannot
  determine it confidently.

Evidence is validated against the extracted job context after Unicode,
quotation-mark, and whitespace normalization. Trusted code does not interpret
the evidence's grammar.

The primary model handles the remaining rubric dimensions. When the helper is
different, both model identifiers are shown and participate in cache identity.

When the state is uncertain, the summary uses the explicit rare fallback:

> The local model could not confidently determine the language requirements.

Schema version 2 remains unchanged, while prompt version 17 invalidates older
cached results.
