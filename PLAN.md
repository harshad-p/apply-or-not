# Apply or Not — Provider Restructure Plan

Branch: `feature/provider-restructure`  
See `DECISIONS.md` for the architectural reasoning behind each decision.

Each task is self-contained and will be committed individually.

---

## Task 1 — Move `expandLocalAnalysis` into `analysis-contract.js`

Move `expandLocalAnalysis` and all its dependencies out of
`local-relay/local-provider.mjs` and into `extension/shared/analysis-contract.js`
so the logic is available to both the relay and the custom server reference
implementation.

**Files changed:**
- `extension/shared/analysis-contract.js` — add `expandLocalAnalysis` and deps
- `local-relay/local-provider.mjs` — remove moved code, import from contract
- `tests/local-provider.test.mjs` — verify nothing broken
- `tests/analysis-contract.test.cjs` — add coverage for moved functions

---

## Task 2 — Add `groq-provider.mjs`

Create `local-relay/groq-provider.mjs`. Calls
`https://api.groq.com/openai/v1/chat/completions` using
`buildOpenAICompatibleRequest`. Reads `GROQ_API_KEY` from the server's key
store. Reuses `normalizeAnalysis` for the response. Full contract — no compact
prompt, no translation, no warmup needed.

**Files changed:**
- `local-relay/groq-provider.mjs` — new file

---

## Task 3 — Update `server.mjs`

Wire Groq as the default provider. Keep OpenAI with user-provided key. Update
`/health` to report which providers are configured. Update `/configure` to accept
keys for both Groq and OpenAI. Remove the assumption that OpenAI is always the
cloud provider.

**Files changed:**
- `local-relay/server.mjs`

---

## Task 4 — Update `configuration.mjs`

Add `"groq"` to `SUPPORTED_PROVIDERS`. Add Groq API key validation (prefix
`gsk_`). Add `validateGroqConfig`. Keep all existing OpenAI and local
validation unchanged.

**Files changed:**
- `local-relay/configuration.mjs`
- `tests/relay-configuration.test.mjs`

---

## Task 5 — Build `custom-server/` reference implementation

Create a minimal reference server that a user can run to point the extension at
their own model. Receives a payload from the extension, calls
`buildFastLocalRequest` to build the compact LLM request, sends it to the
user-configured OpenAI-compatible endpoint, calls `expandLocalAnalysis` to
expand the compact rubric into the full normalized schema, and returns
`{ analysis: normalizedResult }`.

The user configures two things: their model's base URL and the model name.
That is all.

**Files created:**
- `custom-server/server.mjs` — HTTP server, ~80 lines
- `custom-server/provider.mjs` — calls user's model, expands result
- `custom-server/configuration.mjs` — validates user-provided base URL and model
- `custom-server/README.md` — setup instructions for users

---

## Task 6 — Update `service-worker.js` routing

- Default provider (`"free"`) routes to the relay URL, sends `{ payload, providerConfig: { id: "groq" } }`
- OpenAI provider routes to the relay URL, sends `{ payload, providerConfig: { id: "openai" } }`
- Custom server provider routes to the user-entered URL, sends the pre-built
  `buildFastLocalRequest` payload directly

Remove the old local-model-specific `/analyze/start` + polling path from the
custom server route — the custom server responds synchronously.

**Files changed:**
- `extension/background/service-worker.js`

---

## Task 7 — Update extension options UI

Provider selector gains three options:
- **Free** (default) — "Free · Fast cloud analysis"
- **OpenAI** — "OpenAI · GPT-5.6 Sol" (user provides key)
- **Custom server** — "Custom server · Your own model" (user provides URL)

The "Local model" option is removed from the selector — that path now lives in
the custom server. The local base URL and model fields are replaced by a single
custom server URL field. The OpenAI API key section remains, shown only when
OpenAI is selected.

**Files changed:**
- `extension/options/options.html`
- `extension/options/options.js`

---

## Task 8 — Update `TODO.md`

Mark completed items from prior branches. Add new items reflecting the provider
restructure work and what remains after this branch lands.

**Files changed:**
- `TODO.md`
