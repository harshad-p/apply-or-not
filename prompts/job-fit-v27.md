# Job fit prompt v27

Version 27 adds reusable local preference preparation:

- compile free-form preferences once when they are saved;
- use the compact profile for repeated local-model job analysis;
- retain the original text as the trusted source for scoring safeguards;
- require named technologies, languages, and proficiency levels to survive
  validation;
- fall back to the original preferences when the profile loses a named term or
  is not shorter;
- use the preparation request to warm the selected local model before Analyze
  becomes available.

The GPT-5.6 path continues to use the original preference text.
