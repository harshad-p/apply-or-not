import http from "node:http";
import { analyzeWithLocalModel } from "./local-provider.mjs";
import { analyzeWithOpenAI } from "./openai-provider.mjs";
import {
  isAllowedOrigin,
  isExtensionOrigin,
  validateApiKey,
  validateProviderConfig,
} from "./configuration.mjs";

const host = "127.0.0.1";
const port = Number.parseInt(process.env.APPLY_OR_NOT_PORT || "8787", 10);
let apiKey = process.env.OPENAI_API_KEY || "";
const projectId = process.env.OPENAI_PROJECT_ID || "";
const maximumBodyBytes = 128 * 1024;
const localRequests = new Map();
const localJobRetentionMs = 10 * 60 * 1000;

startServer();

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
        reject(new Error("Analysis request is too large."));
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Analysis request must contain valid JSON."));
      }
    });
    request.on("error", reject);
  });
}

function pruneLocalJobs() {
  const cutoff = Date.now() - localJobRetentionMs;
  for (const [requestId, job] of localRequests) {
    if (job.updatedAt < cutoff && job.state !== "running") {
      localRequests.delete(requestId);
    }
  }
}

function localJobResponse(job) {
  if (!job) return { state: "missing" };
  if (job.state === "completed") {
    return { state: job.state, analysis: job.analysis };
  }
  if (job.state === "error") {
    return { state: job.state, error: job.error };
  }
  return { state: job.state };
}

function startServer() {
  const server = http.createServer(async (request, response) => {
    const origin = request.headers.origin || "";
    const requestUrl = new URL(request.url, `http://${host}:${port}`);

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
      sendJson(
        response,
        200,
        {
          ok: true,
          provider: "openai",
          model: "gpt-5.6-sol",
          configured: Boolean(apiKey),
          providers: {
            openai: {
              model: "gpt-5.6-sol",
              configured: Boolean(apiKey),
            },
            local: {
              configured: true,
            },
          },
        },
        origin,
      );
      return;
    }

    if (request.method === "POST" && request.url === "/configure") {
      if (!isExtensionOrigin(origin)) {
        sendJson(response, 403, { error: "Only the extension can configure the relay." });
        return;
      }
      try {
        const body = await readJson(request);
        apiKey = validateApiKey(body?.apiKey);
        sendJson(response, 200, { ok: true, configured: true }, origin);
      } catch (error) {
        sendJson(response, 400, { error: error.message }, origin);
      }
      return;
    }

    if (request.method === "POST" && request.url === "/analyze/start") {
      try {
        pruneLocalJobs();
        const body = await readJson(request);
        const requestId =
          typeof body?.requestId === "string" ? body.requestId.trim() : "";
        if (!/^[a-f0-9]{16}$/u.test(requestId)) {
          throw new Error("Local analysis request ID is invalid.");
        }
        const existing = localRequests.get(requestId);
        if (existing) {
          sendJson(response, 200, localJobResponse(existing), origin);
          return;
        }

        const providerConfig = validateProviderConfig(body?.providerConfig);
        if (providerConfig.id !== "local") {
          throw new Error("A local provider is required for a relay job.");
        }
        const controller = new AbortController();
        const startedAt = Date.now();
        const job = {
          state: "running",
          controller,
          startedAt,
          updatedAt: Date.now(),
        };
        localRequests.set(requestId, job);
        console.log(
          `Local analysis ${requestId} started (${body?.payload?.job?.description?.length || 0} description characters).`,
        );
        void analyzeWithLocalModel(body?.payload, providerConfig, {
          signal: controller.signal,
          onMetrics: (metrics) => {
            job.metrics = metrics;
          },
        })
          .then((analysis) => {
            Object.assign(job, {
              state: "completed",
              analysis,
              updatedAt: Date.now(),
            });
            const metrics = job.metrics || {};
            console.log(
              `Local analysis ${requestId} completed in ${(
                (Date.now() - startedAt) /
                1000
              ).toFixed(1)}s (${metrics.sentDescriptionCharacters ?? "?"} characters sent, ${metrics.promptTokens ?? "?"} prompt tokens, ${metrics.completionTokens ?? "?"} completion tokens).`,
            );
          })
          .catch((error) => {
            Object.assign(job, {
              state: controller.signal.aborted ? "canceled" : "error",
              error: error.message,
              updatedAt: Date.now(),
            });
            console.log(
              `Local analysis ${requestId} ${job.state} after ${(
                (Date.now() - startedAt) /
                1000
              ).toFixed(1)}s: ${error.message}`,
            );
          });
        sendJson(response, 202, { state: "running" }, origin);
      } catch (error) {
        sendJson(response, 400, { error: error.message }, origin);
      }
      return;
    }

    if (
      request.method === "GET" &&
      requestUrl.pathname === "/analyze/status"
    ) {
      const requestId = requestUrl.searchParams.get("requestId") || "";
      if (!/^[a-f0-9]{16}$/u.test(requestId)) {
        sendJson(response, 400, { error: "Local analysis request ID is invalid." }, origin);
        return;
      }
      pruneLocalJobs();
      sendJson(
        response,
        200,
        localJobResponse(localRequests.get(requestId)),
        origin,
      );
      return;
    }

    if (request.method === "POST" && request.url === "/analyze") {
      let requestId = "";
      let controller;
      try {
        const requestBody = await readJson(request);
        const isWrappedRequest =
          requestBody?.payload && typeof requestBody.payload === "object";
        const payload = isWrappedRequest ? requestBody.payload : requestBody;
        const providerConfig = validateProviderConfig(
          isWrappedRequest ? requestBody.providerConfig : { id: "openai" },
        );
        requestId =
          typeof requestBody?.requestId === "string"
            ? requestBody.requestId.trim()
            : "";
        if (requestId && !/^[a-f0-9]{16}$/u.test(requestId)) {
          throw new Error("Local analysis request ID is invalid.");
        }
        controller = new AbortController();
        if (providerConfig.id === "local" && requestId) {
          localRequests.set(requestId, {
            state: "running",
            controller,
            updatedAt: Date.now(),
          });
        }
        const analysis =
          providerConfig.id === "local"
            ? await analyzeWithLocalModel(payload, providerConfig, {
                signal: controller.signal,
              })
            : await analyzeWithOpenAI(payload, { apiKey, projectId });
        sendJson(response, 200, { analysis }, origin);
      } catch (error) {
        console.error(`Analysis failed: ${error.message}`);
        if (!response.destroyed) {
          sendJson(response, 400, { error: error.message }, origin);
        }
      } finally {
        if (requestId && localRequests.get(requestId)?.controller === controller) {
          localRequests.delete(requestId);
        }
      }
      return;
    }

    if (request.method === "POST" && request.url === "/analyze/cancel") {
      try {
        const body = await readJson(request);
        const requestId =
          typeof body?.requestId === "string" ? body.requestId.trim() : "";
        if (!/^[a-f0-9]{16}$/u.test(requestId)) {
          throw new Error("Local analysis request ID is invalid.");
        }
        const job = localRequests.get(requestId);
        job?.controller?.abort();
        if (job) {
          Object.assign(job, { state: "canceled", updatedAt: Date.now() });
        }
        sendJson(
          response,
          200,
          { canceled: Boolean(job) },
          origin,
        );
      } catch (error) {
        sendJson(response, 400, { error: error.message }, origin);
      }
      return;
    }

    sendJson(response, 404, { error: "Not found." }, origin);
  });

  server.on("error", (error) => {
    console.error(`Could not start the local relay: ${error.message}`);
    process.exitCode = 1;
  });

  server.listen(port, host, () => {
    console.log(`Apply or Not relay listening on http://${host}:${port}`);
    console.log(
      apiKey
        ? "OpenAI is configured from the process environment."
        : "OpenAI is not configured. Enter a key in the extension settings.",
    );
    console.log("The OpenAI API key is kept only in this relay process.");
    console.log(
      "Local model requests are restricted to localhost and loopback addresses.",
    );
  });
}
