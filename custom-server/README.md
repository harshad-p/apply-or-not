# Apply or Not — Custom Server

A reference implementation that lets you point the Apply or Not browser
extension at your own model. The extension sends the job and your criteria;
this server builds the prompt, calls your model, and returns a normalized
result in the same schema as the main relay.

## What this server does

1. Receives an analysis payload from the extension
2. Builds a compact LLM request using `buildFastLocalRequest` from the
   shared analysis contract
3. Sends the request to your OpenAI-compatible model endpoint
4. Expands the compact rubric output into the full normalized schema
5. Returns `{ analysis: ... }` — the same shape the extension expects

The extension validates the result with `validateModelOutput` regardless of
which server produced it, so your server just needs to satisfy the schema.

## What the user gets

- Full rubric scoring across all 6 dimensions
- Evidence items per dimension
- A generated summary
- Language requirement detection
- Score, recommendation (apply / consider / skip), confidence

Note: the compact contract is optimized for smaller models. For maximum
accuracy, use the main relay with the Free (Groq) or OpenAI provider.

## Requirements

- Node.js 18 or later
- An OpenAI-compatible model server running locally or on your network
  (Ollama, LM Studio, vLLM, llama.cpp with an HTTP server, etc.)

## Setup

```bash
# Install dependencies (only the shared analysis-contract.js is needed;
# no additional packages required)
cd custom-server

# Set your model configuration
export CUSTOM_MODEL_BASE_URL=http://127.0.0.1:11434/v1   # default
export CUSTOM_MODEL_NAME=llama3.2:3b                      # required
export CUSTOM_MODEL_API_KEY=                              # optional

# Start the server
node server.mjs
```

The server listens on `http://127.0.0.1:8788` by default. Change the port
with `CUSTOM_SERVER_PORT`.

## Configuring the extension

1. Open the extension options page
2. Select **Custom server** as the provider
3. Enter `http://127.0.0.1:8788` (or your chosen URL) as the server URL
4. Save preferences

The extension will route analysis requests to your server instead of the
main relay.

## Model requirements

Your model must:
- Accept OpenAI-compatible Chat Completions requests (`POST /chat/completions`)
- Support the `response_format: { type: "json_schema" }` parameter, or at
  least return valid JSON matching the compact rubric schema
- Handle a system prompt and a user message with job + criteria content

**Recommended models (Ollama):**
- `qwen3.5:2b-q4_K_M` — fast, handles German, good structured output
- `llama3.2:3b-instruct-q4_K_M` — reliable alternative on 4 GB VRAM

## Response schema

The server returns:

```json
{
  "analysis": {
    "schemaVersion": 2,
    "promptVersion": "job-fit-v31",
    "score": 74,
    "recommendation": "consider",
    "confidence": "medium",
    "summary": "...",
    "rubric": { ... },
    "positiveMatches": [ ... ],
    "concerns": [ ... ],
    "hardBlockers": [ ... ],
    "uncertainties": [ ... ],
    "postingLanguage": "English",
    "languageRequirements": [ ... ],
    "provider": {
      "id": "custom",
      "model": "llama3.2:3b",
      "responseId": "",
      "durationMs": 4200
    }
  }
}
```

This is identical to the schema returned by the main relay.

## Environment variables

| Variable               | Default                           | Description                        |
|------------------------|-----------------------------------|------------------------------------|
| `CUSTOM_SERVER_PORT`   | `8788`                            | Port to listen on                  |
| `CUSTOM_MODEL_BASE_URL`| `http://127.0.0.1:11434/v1`       | OpenAI-compatible base URL         |
| `CUSTOM_MODEL_NAME`    | *(required)*                      | Model identifier                   |
| `CUSTOM_MODEL_API_KEY` | *(empty)*                         | API key if your server requires one|
