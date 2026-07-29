function isExtensionOrigin(origin) {
  return /^(chrome-extension|moz-extension|safari-web-extension):\/\//iu.test(
    origin || "",
  );
}

const DEFAULT_LOCAL_BASE_URL = "http://127.0.0.1:11434/v1";
const SUPPORTED_PROVIDERS = Object.freeze(["openai", "local"]);

function isAllowedOrigin(origin) {
  return !origin || isExtensionOrigin(origin);
}

function validateApiKey(value) {
  if (typeof value !== "string") {
    throw new Error("Enter a valid OpenAI API key.");
  }
  const apiKey = value.trim();
  if (apiKey.length < 20 || apiKey.length > 500) {
    throw new Error("Enter a valid OpenAI API key.");
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
  const id = validateProviderId(value.id || "openai");
  if (id === "openai") return Object.freeze({ id });

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
