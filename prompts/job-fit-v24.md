# Job fit prompt v24

Version 24 tightens language blocker enforcement:

- recognize a blocker as language-related when its evidence contains one or
  more grounded language-requirement excerpts or names their languages;
- handle combined German and English evidence instead of requiring exact
  equality with one requirement;
- demote that blocker to a scored language conflict unless the user explicitly
  says reject, skip, never apply, or hard blocker;
- invalidate cached results that received the incorrect 35-point blocker cap.
