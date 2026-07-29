# Job fit prompt v19

Version 19 changes local preprocessing while preserving the structured scoring
contract:

- normalize mixed German and English job text into English with the dedicated
  local OPUS German-to-English translation model;
- keep English passages readable rather than assuming the entire page is
  German;
- preserve language-related passages when long local input is compacted;
- use one small English-capable analysis model instead of routing language
  extraction through a second chat model;
- keep trusted code responsible for preprocessing, validation, scoring, and
  presentation while the analysis model interprets the translated meaning.
