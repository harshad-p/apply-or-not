# Job fit prompt v21

Version 21 makes translation expansion recoverable:

- retain the translation length guard;
- fall back to the original German passage when a translation expands
  unexpectedly;
- continue analysis with the remaining mixed-language text instead of failing
  the entire job;
- invalidate cached results from the previous preprocessing behavior.
