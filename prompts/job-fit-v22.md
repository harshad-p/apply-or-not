# Job fit prompt v22

Version 22 distinguishes absence from ambiguity:

- after scanning the complete supplied posting, return `none` when there is no
  explicit language requirement;
- do not report uncertainty merely because the posting contains no language
  qualification;
- reserve `uncertain` for wording that actually discusses language proficiency
  but cannot be interpreted confidently;
- invalidate cached language summaries produced by the older distinction.
