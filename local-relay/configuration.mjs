function isExtensionOrigin(origin) {
  return /^(chrome-extension|moz-extension|safari-web-extension):\/\//iu.test(
    origin || "",
  );
}

const DEFAULT_LOCAL_BASE_URL = "http://127.0.0.1:11434/v1";

// Recommended model for 4 GB VRAM cards:
//   llama3.2:3b-instruct-q4_K_M
//
// Why this model:
//   - Q4_K_M weighs ~2.0 GB, fitting entirely in 4 GB VRAM with headroom for
//     the KV cache and GPU activations (all 28 layers land on the GPU).
//   - K-quantization preserves more precision in attention layers than plain
//     Q4_0, giving better structured-JSON output accuracy.
//   - 3B has sufficient instruction-following for the compact rubric contract
//     used by this project (220-token output).
//
// To pull the recommended model:
//   ollama pull llama3.2:3b-instruct-q4_K_M
//
// Verify GPU layers after pulling:
//   ollama ps   (look for "28/28 layers" under GPU column)
const SUPPORTED_PROVIDERS = Object.freeze(["free", "openai", "local"]);

function isAllowedOrigin(origin) {
  return !origin || isExtensionOrigin(origin);
}

function validateApiKey(value, providerHint = "openai") {
  if (typeof value !== "string") {
    throw new Error(
      providerHint === "groq"
        ? "Enter a valid Groq API key."
        : "Enter a valid OpenAI API key.",
    );
  }
  const apiKey = value.trim();
  if (apiKey.length < 20 || apiKey.length > 500) {
    throw new Error(
      providerHint === "groq"
        ? "Enter a valid Groq API key."
        : "Enter a valid OpenAI API key.",
    );
  }
  return apiKey;
}

function validateProviderId(value) {
  const provider = typeof value === "string" ? value.trim() : "";
  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    throw new Error("Select a supported analysis provider.");
  }
  return provider;
}

function validateLocalBaseUrl(value) {
  if (typeof value !== "string" || value.length > 500) {
    throw new Error("Enter a valid local model base URL.");
  }

  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Enter a valid local model base URL.");
  }

  const loopbackHosts = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);
  if (
    url.protocol !== "http:" ||
    !loopbackHosts.has(url.hostname.toLocaleLowerCase()) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "The local model URL must use HTTP on localhost or a loopback address.",
    );
  }

  url.pathname = url.pathname.replace(/\/+$/u, "") || "/";
  return url.toString().replace(/\/$/u, "");
}

function validateLocalModel(value) {
  if (typeof value !== "string") {
    throw new Error("Enter the local model identifier.");
  }
  const model = value.trim();
  if (!model || model.length > 200) {
    throw new Error("Enter the local model identifier.");
  }
  return model;
}

function validateProviderConfig(value = {}) {
  const id = validateProviderId(value.id || "free");
  if (id === "free" || id === "openai") return Object.freeze({ id });

  return Object.freeze({
    id,
    baseUrl: validateLocalBaseUrl(
      value.baseUrl || DEFAULT_LOCAL_BASE_URL,
    ),
    model: validateLocalModel(value.model),
  });
}

export {
  DEFAULT_LOCAL_BASE_URL,
  SUPPORTED_PROVIDERS,
  isAllowedOrigin,
  isExtensionOrigin,
  validateApiKey,
  validateLocalBaseUrl,
  validateLocalModel,
  validateProviderConfig,
  validateProviderId,
};
