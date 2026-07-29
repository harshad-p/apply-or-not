# Job fit prompt v30

Version 30 separates programming languages from human-language requirements in
the optimized Qwen path:

- explicitly classify Java, C#, C++, Python, JavaScript, and SQL as software
  technologies rather than spoken-language qualifications;
- use a semantic verifier classification before accepting likely
  human-language passages;
- reject model claims whose quoted evidence is clearly only a programming
  language requirement;
- skip the second Ollama request when no supported human-language requirement
  remains.

The German/English shared-sentence verifier from version 29 remains in place.
Trusted code retains both confirmed requirements internally while the summary
mentions only the requirement that conflicts with the applicant's preferences.
