# Job fit prompt v26

Version 26 corrects local scoring for close technology matches:

- classify skills as a match when the posting contains the user's named core
  skills and does not require a missing deal-breaker skill;
- do not invent React, Angular, or Vue requirements from a full-stack title;
- treat Blazor as a .NET UI framework rather than a missing JavaScript framework;
- mention only conflicting languages in the short concern summary, so a
  satisfied English requirement is not grouped with a German-language gap.

The compact local-output contract from version 25 remains unchanged.
