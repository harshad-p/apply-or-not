# Job fit prompt v29

Version 29 makes multilingual local-model extraction more reliable:

- require a separate result item for every human language named in a shared
  sentence, including conjunctions such as `Deutsch und Englisch`;
- run a small semantic language-verification request when Qwen receives likely
  language-requirement passages;
- keep grammatical interpretation in the model while trusted code preserves
  the exact source passage, validates the result, and recalculates the score;
- mention all confirmed required languages in the short local summary.

The verification request disables hidden thinking and uses a minimal schema so
it adds only a few seconds instead of invoking the much slower translation
model.
