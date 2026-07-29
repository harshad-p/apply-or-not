# Job-fit analysis prompt - v16

The executable prompts and strict JSON Schemas live in
`extension/shared/analysis-contract.js`.

Prompt v16 keeps the classification-only local contract from v15 and adds
deterministic extraction for common explicit German and English proficiency
requirements. For example:

- `Sehr gute Deutschkenntnisse in Wort und Schrift`
- `Gute Englischkenntnisse`
- German C1/C2, fluent, business-level, and `verhandlungssicher` formulations

When the user explicitly asks for a strong reduction for fluent, C1, C2, or
business-level German, a detected strong German requirement becomes a language
conflict. It reduces the deterministic score but does not become a hard blocker
unless the user explicitly describes it as one.

This prevents a small local model from converting visible language requirements
into “no explicit language requirement found.” Schema version 2 remains
unchanged, while prompt version 16 invalidates older cached results.
