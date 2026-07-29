# Job fit prompt v28

Version 28 adds an optimized Qwen 3.5 path for Ollama:

- use Ollama's native chat endpoint on its default port;
- explicitly disable hidden thinking;
- keep the selected model loaded for 30 minutes;
- let multilingual Qwen read mixed German/English text directly;
- normalize language labels such as `German (fluent)` to `German`;
- repair an inconsistent `none` status when grounded requirements were returned.

The raw job description, compact preference profile, trusted scoring, evidence
validation, and fallback provider path remain in place.
