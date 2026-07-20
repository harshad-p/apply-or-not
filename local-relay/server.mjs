import http from "node:http";
import { analyzeWithOpenAI } from "./openai-provider.mjs";
import {
  isAllowedOrigin,
  isExtensionOrigin,
  validateApiKey,
} from "./configuration.mjs";

const host = "127.0.0.1";
const port = Number.parseInt(process.env.APPLY_OR_NOT_PORT || "8787", 10);
let apiKey = process.env.OPENAI_API_KEY || "";
const projectId = process.env.OPENAI_PROJECT_ID || "";
const maximumBodyBytes = 128 * 1024;

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

function startServer() {
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
      sendJson(
        response,
        200,
        {
          ok: true,
          provider: "openai",
          model: "gpt-5.6-sol",
          configured: Boolean(apiKey),
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

    if (request.method === "POST" && request.url === "/analyze") {
      try {
        const payload = await readJson(request);
        const analysis = await analyzeWithOpenAI(payload, { apiKey, projectId });
        sendJson(response, 200, { analysis }, origin);
      } catch (error) {
        console.error(`Analysis failed: ${error.message}`);
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
  });
}
