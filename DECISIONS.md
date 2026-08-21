# Apply or Not — Architectural Decisions

This document records the key architectural decisions made during the provider
restructure (branch: feature/provider-restructure). It captures *why* each
decision was made, not just what was done.

---

## 1. Groq as the default free tier

**Decision:** The default analysis provider is Groq, using a server-side API key
owned by the project author. The extension calls this "Free" in the UI. The word
"Groq" does not need to appear in user-facing text.

**Why:**
- Groq's free plan is fast (typically under 3 seconds for a full analysis) and
  accurate enough to use the full analysis contract — no compact prompt needed.
- OpenAI GPT-5.6 costs money per request. Local inference is slow and requires
  hardware setup. Groq gives users a zero-setup, zero-cost default.
- Groq's API is OpenAI Chat Completions-compatible, so `buildOpenAICompatibleRequest`
  from `analysis-contract.js` works without modification.
- The server-side key never touches the extension or the browser. This matches
  the security model already established for the OpenAI key in the local relay.

---

## 2. One server, not two

**Decision:** The local relay (`local-relay/server.mjs`) becomes *the* server —
handling Free (Groq), OpenAI, and routing. It runs locally now and can be
deployed as a hosted service later. There is no separate "cloud server".

**Why:**
- The local relay already owns the security boundary: API keys live here, not in
  the extension. Splitting would duplicate that boundary.
- The extension already hardcodes one relay URL. Adding a second URL for a
  different provider class adds complexity with no architectural gain.
- The relay's existing routing pattern (`providerConfig.id`) cleanly accommodates
  a third provider without structural change.
- `PROJECT_BRIEF.md` explicitly states: "URL validation, timeouts, response
  normalization, and schema checks remain in one place."

---

## 3. Custom server path sends a pre-built compact request

**Decision:** When the user configures a custom server URL, the extension builds
the full LLM request (prompt + schema + job content) using `buildFastLocalRequest`
from `analysis-contract.js` and sends it ready-to-fire. The custom server only
needs to forward it to a model and return a normalized result.

**Why:**
- The user should not need to understand the analysis contract, rubric, or prompt
  engineering to run their own server. The extension does that work.
- The compact contract (`buildFastLocalRequest`) is appropriate here: it uses a
  220-token output budget so any capable model can handle it, even small ones.
- The full contract (`buildOpenAICompatibleRequest`) stays on the main server
  where Groq 70B or OpenAI can handle its complexity and token requirements.
- This gives users a clean, minimal integration surface: receive a payload,
  forward to model, return JSON.

---

## 4. expandLocalAnalysis moves to analysis-contract.js

**Decision:** `expandLocalAnalysis` and its dependencies (rubric scoring,
evidence building, summary generation, language evidence expansion) are moved
from `local-relay/local-provider.mjs` into `extension/shared/analysis-contract.js`.

**Why:**
- The custom server reference implementation needs `expandLocalAnalysis` to turn
  the compact rubric output into the full normalized schema.
- `analysis-contract.js` is already the shared module used by both the relay
  (via `require`) and the extension (via `importScripts`). It is the right home
  for any logic that must be available to multiple consumers.
- Keeping it in `local-provider.mjs` would force the custom server to depend on
  the local relay's internal module, which is the wrong dependency direction.

---

## 5. Key resolution model

**Decision:** The server resolves API keys in this priority order:
1. Key set via `/configure` for this session (user-provided, held in memory only)
2. Key from environment variable (`GROQ_API_KEY` or `OPENAI_API_KEY`)
3. No key → return a clear error to the extension

**Why:**
- The environment variable is the right place for a server-managed key (the
  author's Groq key in production, a developer's key in local dev).
- The `/configure` endpoint lets a user override with their own key without
  restarting the server, matching the existing OpenAI key flow.
- Keys are never stored to disk, never returned to the extension, and never
  logged. The relay process is the security boundary.

---

## 6. The extension always validates against one normalized schema

**Decision:** Every provider path — Free (Groq), OpenAI, custom server — returns
`{ analysis: normalizedResult }` in the same shape. The extension calls
`validateModelOutput` on every response regardless of source.

**Why:**
- The extension must behave consistently. A score, recommendation, and summary
  must always be present and valid regardless of which server produced them.
- `validateModelOutput` already exists and is already called for all paths. This
  decision simply makes it the contract boundary for the custom server too.
- Custom server authors get a clear, testable target: produce this schema and the
  extension will work. The schema is defined in `analysis-contract.js`.
