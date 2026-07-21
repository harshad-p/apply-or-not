# Apply or Not — product demo continuation

This continues after the personal problem/setup slides. Keep the delivery
conversational; the bracketed text is direction, not voiceover.

## Voiceover and screen direction

**[Reveal the Apply or Not logo.]**

“And so, with some help from Codex, Apply or Not was born.”

**[Show the browser's extension-development screen, then load Apply or Not.]**

“First, I load the extension in my browser. Its WebExtension core supports
Safari, Chromium, and Firefox.”

**[Show a terminal and run `node local-relay/server.mjs`.]**

“Next, I start a small local relay, which keeps my API key out of the extension
itself.”

**[In the settings page, paste `sk-demo-NOT_A_REAL_KEY-0123456789`. Add a large
on-screen caption: `FAKE KEY — FOR VIDEO ONLY`. Cut before the live test and
configure the real key off-camera.]**

“The key on screen is deliberately fake; I configure the real one off-camera.
It is never saved in browser storage. The relay holds it only in memory and
forgets it when Node stops.”

**[Show the preferences field.]**

“Then I describe what I want from a job. I can write naturally—or ramble—about
my skills, languages, preferred working style, and deal-breakers.”

**[Run `python3 -m http.server 4173 --directory extension`, then open
`http://localhost:4173/fixtures/demo-scenarios.html`.]**

“For a safe, repeatable video, this Python command serves four fictional job
pages. It is only for the demo; real job sites do not need it.”

**[Open and analyze each scenario.]**

“The English posting is a strong match. The German posting is also a strong
match because English is the working language and German is optional. Apply or
Not keeps the page language separate from the actual language requirement.

The third role requires frontend leadership, German C1, and onsite work, so it
scores poorly. The fourth matches my skills, but applications are closed—so
availability overrides fit and the score is zero.”

**[Open one result and scroll through the popup.]**

“The popup shows positive matches, concerns, blockers, and evidence. Analysis
continues if I close it, and the result is waiting when I reopen it.”

**[Choose Reanalyze, stop at the confirmation. Then show Run no-cost demo.]**

“Reanalyzing can create another paid request, so the extension warns me first.
Its clearly labeled demo mode uses synthetic data and makes no API call.”

**[Show a simple Next steps slide.]**

“Next, I want to support local LLMs through tools such as Ollama or LM Studio,
add deeper support for more job sites, and help explain untranslated application
forms and company information.”

**[Return to logo and tagline.]**

“Apply or Not is a second opinion, not the final decision. It helps me spend
less time sorting and more time examining promising roles. To apply or not—that
is the question.”

## Key-recording note

Do not use `0123456789_THIS_KEY_GIVES_LIFETIME_UNLIMITED_TOKENS_0123456789` in
the final cut. It is not a secret, but the “lifetime unlimited tokens” wording
can sound like a genuine product claim. Use the explicitly fake placeholder
above, keep the `FAKE KEY` caption visible, and configure the working key only
off-camera.
