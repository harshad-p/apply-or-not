# Job-fit analysis prompt - v15

The executable prompts and strict JSON Schemas live in
`extension/shared/analysis-contract.js`.

Prompt v15 keeps the classification-only local contract from v14. When language
is unknown because the posting contains no explicit language requirement, the
deterministic summary now states that fact neutrally:

> No explicit language requirement was found in the posting.

This avoids presenting missing language evidence as a negative signal. Schema
version 2 remains unchanged, while prompt version 15 invalidates older cached
results.
