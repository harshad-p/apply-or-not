function isExtensionOrigin(origin) {
  return /^(chrome-extension|moz-extension|safari-web-extension):\/\//iu.test(
    origin || "",
  );
}

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

export { isAllowedOrigin, isExtensionOrigin, validateApiKey };
