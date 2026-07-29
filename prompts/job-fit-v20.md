# Job fit prompt v20

Version 20 fixes mixed-language translation preprocessing:

- route only German-looking passages through the German-to-English model;
- leave ordinary English passages untouched;
- cap translation generation and reject unexpectedly expanded output;
- compact translated content again before local inference;
- invalidate cached results produced by the earlier over-expansion bug.
