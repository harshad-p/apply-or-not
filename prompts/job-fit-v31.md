# Job fit prompt v31

Version 31 preserves the fast one-call Qwen path:

- the model determines whether evidence is a human-language requirement;
- trusted validation rejects claims grounded solely in programming-language
  evidence such as `Java, C++, or C#`;
- trusted evidence expansion enumerates explicitly named human languages in a
  model-approved quotation, so `Deutsch und Englisch` yields German and English
  without a second local-model inference.

The score continues to be calculated by trusted code. The short summary names
only language requirements that conflict with the applicant's preferences.
