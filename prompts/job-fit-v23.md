# Job fit prompt v23

Version 23 tightens evidence grounding:

- discard language requirements whose evidence does not occur in the supplied
  posting;
- when every claimed requirement is discarded as unsupported, report that no
  explicit language requirement was found instead of showing uncertainty;
- keep uncertainty for grounded but genuinely ambiguous language wording;
- invalidate cached summaries from the previous grounding behavior.
