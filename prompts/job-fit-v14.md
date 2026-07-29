# Job-fit analysis prompt - v14

The executable prompts and strict JSON Schemas live in
`extension/shared/analysis-contract.js`.

Prompt v14 removes summary generation from the latency-first local model
contract. The local model now returns only rubric classifications, short
evidence, confidence, blockers, posting language, and explicit language
requirements.

Trusted JavaScript calculates the percentage and recommendation, writes a short
summary from the validated rubric, and expands the positive and concern
sections. This prevents small local models from displaying a contradictory,
invented, or token-truncated headline.

The local output allowance is 500 tokens. All prompt v13 safeguards remain in
place. Schema version 2 remains unchanged, while prompt version 14 invalidates
older cached local and cloud results.
