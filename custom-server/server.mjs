/**
 * Apply or Not — Custom Server Reference Implementation
 *
 * This server lets you point the Apply or Not extension at your own model.
 * It receives an analysis payload from the extension, builds a compact LLM
 * request, sends it to your OpenAI-compatible endpoint, expands the result
 * into the full normalized schema, and returns it to the extension.
 *
 * Configuration (environment variables):
 *   CUSTOM_SERVER_PORT    Port to listen on (default: 8788)
 *   CUSTOM_MODEL_BASE_URL Base URL of your OpenAI-compatible model server
 *                         (default: http://127.0.0.1:11434/v1)
 *   CUSTOM_MODEL_NAME     Model identifier (required)
 *   CUSTOM_MODEL_API_KEY  API key if your model server requires one (optional)
 */

import http from "node:http";
import { analyzeWithCustomModel } from "./provider.mjs";
import { isValidLoopbackOrConfiguredUrl } from "./configuration.mjs";

const host = "127.0.0.1";
const port = Number.parseInt(process.env.CUSTOM_SERVER_PORT || "8788", 10);
const maximumBodyBytes = 128 * 1024;

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Private-Network": "true",
    Vary: "Origin",
  };
}

function sendJson(response, status, body, origin = "") {
  response.writeHead(status, {
    ...corsHeaders(origin),
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    let bytes = 0;
    let tooLarge = false;

    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      bytes += Buffer.byteLength(chunk);
      if (bytes > maximumBodyBytes) {
        tooLarge = true;
        return;
      }
      body += chunk;
    });
    request.on("end", () => {
      if (tooLarge) {
        reject(new Error("Request is too large."));
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Request must contain valid JSON."));
      }
    });
    request.on("error", reject);
  });
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  return /^(chrome-extension|moz-extension|safari-web-extension):\/\//iu.test(origin);
}

const server = http.createServer(async (request, response) => {
  const origin = request.headers.origin || "";

  if (!isAllowedOrigin(origin)) {
    sendJson(response, 403, { error: "Request origin is not allowed." });
    return;
  }

  if (request.method === "OPTIONS") {
    response.writeHead(204, corsHeaders(origin));
    response.end();
    return;
  }

  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, {
      ok: true,
      providers: {
        custom: {
          configured: Boolean(process.env.CUSTOM_MODEL_NAME),
          model: process.env.CUSTOM_MODEL_NAME || "",
          baseUrl: process.env.CUSTOM_MODEL_BASE_URL || "http://127.0.0.1:11434/v1",
        },
      },
    }, origin);
    return;
  }

  if (request.method === "POST" && request.url === "/analyze") {
    try {
      const body = await readJson(request);
      const payload = body?.payload || body;
      const startedAt = Date.now();
      const analysis = await analyzeWithCustomModel(payload);
      sendJson(response, 200, {
        analysis: {
          ...analysis,
          provider: {
            ...analysis.provider,
            durationMs: Date.now() - startedAt,
          },
        },
      }, origin);
    } catch (error) {
      console.error(`Analysis failed: ${error.message}`);
      if (!response.destroyed) {
        sendJson(response, 400, { error: error.message }, origin);
      }
    }
    return;
  }

  sendJson(response, 404, { error: "Not found." }, origin);
});

server.on("error", (error) => {
  console.error(`Could not start the custom server: ${error.message}`);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  const baseUrl = process.env.CUSTOM_MODEL_BASE_URL || "http://127.0.0.1:11434/v1";
  const model = process.env.CUSTOM_MODEL_NAME || "(not configured)";
  console.log(`Apply or Not custom server listening on http://${host}:${port}`);
  console.log(`Model: ${model}`);
  console.log(`Base URL: ${baseUrl}`);
  if (!process.env.CUSTOM_MODEL_NAME) {
    console.warn("Warning: CUSTOM_MODEL_NAME is not set. Analysis will fail.");
  }
});
