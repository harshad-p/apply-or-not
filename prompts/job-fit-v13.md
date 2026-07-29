# Job-fit analysis prompt - v13

The executable prompts and strict JSON Schemas live in
`extension/shared/analysis-contract.js`. Keep this document synchronized with
that implementation.

Prompt v13 leaves the GPT-5.6 cloud contract unchanged and adds a smaller local
contract for CPU-bound inference. The local model returns:

- fixed rubric applicability and outcomes;
- one short evidence excerpt per dimension;
- confidence and one concise summary;
- explicit hard blockers;
- posting language and explicit language requirements.

Trusted JavaScript, rather than the local model, calculates the final score and
recommendation and expands classifications into the popup's positive-match and
concern sections. It also:

- rejects blocker evidence that is not present in the extracted job context;
- prevents clearly unstated work-arrangement, language, seniority, application
  method, and other-preference dimensions from affecting the score;
- treats “Easy Apply is convenient but not required” as no application-method
  criterion;
- filters unsupported language requirements;
- corrects an obviously wrong English/German posting-language label;
- forces a closed application to score 0 through the existing deterministic
  rule.

The local output allowance is 700 tokens. The job-description input remains
limited to 9,000 representative characters. Alternative requirements,
transferable skills, posting-language separation, application-control evidence,
and prompt-injection resistance remain explicit rules.

The recommended latency-first Ollama identifier is `qwen3:0.6b`. It is
multilingual and small enough for practical CPU use, but users can configure a
larger structured-output-capable model when they prefer more nuanced analysis.

Schema version 2 remains unchanged. Prompt version 13 invalidates older cached
results.
