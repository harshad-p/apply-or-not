# Job fit prompt v18

Version 18 keeps language understanding semantic while making local-model
results safer to score:

- scan the complete posting for language requirements in any language;
- return every language statement with its original evidence;
- classify each requirement separately against the applicant's criteria;
- treat adjacent qualifications as separate requirements unless the posting
  explicitly presents them as alternatives;
- aggregate individual language fits in trusted code, using the most serious
  result so one match cannot conceal a conflict;
- keep deterministic code limited to validation, aggregation, scoring, and
  presentation rather than language-specific grammar rules.
