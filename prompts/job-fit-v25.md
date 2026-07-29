# Job fit prompt v25

Version 25 reduces local-model inference work:

- replace six nested rubric objects with six outcome strings;
- request only one possible blocker and minimal language evidence;
- remove model-generated confidence, posting language, summaries, and detailed
  positive/concern explanations;
- reduce the local output allowance from 500 to 220 tokens;
- let trusted code calculate the score and write the short summary;
- show only the score and summary in the popup for live local analysis.

The OpenAI GPT-5.6 response contract and its detailed popup remain unchanged.
