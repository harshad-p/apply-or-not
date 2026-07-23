# Job-fit analysis prompt - v11

The executable prompt and strict JSON Schema live in
`extension/shared/analysis-contract.js`. Keep both versions synchronized.

GPT-5.6 and configured local models interpret free-form applicant criteria and
extracted job evidence. Trusted code calculates the final percentage from fixed
rubric classifications.

Prompt v11 preserves the v10 evidence, transferability, application-method,
closed-listing, language, applicability, and deterministic-scoring rules.

## Concise structured output

- Summary: one or two sentences, no more than 240 characters.
- Positive matches: at most three.
- Concerns: at most three.
- Hard blockers: at most two.
- Uncertainties: at most three.
- Language requirements: at most three.
- Each explanation: one concise sentence.
- Evidence: a short quotation or close original-language excerpt.

These limits reduce local generation time while retaining the most important
decision evidence. Trusted normalization still compacts an overlong summary.

## Local input budget

The local provider sends at most 9,000 job-description characters. Oversized
pages retain representative text from the beginning, middle, and end. Extracted
title, company, location, application method, and application availability
remain separate structured fields. Cloud GPT-5.6 analysis continues to receive
the full extracted description.

The local OpenAI-compatible output allowance is 1,800 tokens. Relay logs report
elapsed time, original and transmitted description size, and provider token
counts when Ollama supplies them.

Schema version 2 remains unchanged. Prompt version 11 invalidates older cached
results.
