/**
 * Configuration validation for the custom server.
 * Kept intentionally minimal — the custom server trusts the environment
 * to provide a valid model URL and name.
 */

const DEFAULT_BASE_URL = "http://127.0.0.1:11434/v1";
const loopbackHosts = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

/**
 * Returns true when the URL is a valid HTTP loopback address.
 * Used to warn when someone accidentally points at an external host
 * in a dev environment, but not enforced as a hard block — users may
 * intentionally point at a LAN or remote model server.
 */
function isLoopbackUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "http:" &&
      loopbackHosts.has(url.hostname.toLocaleLowerCase())
    );
  } catch {
    return false;
  }
}

function isValidLoopbackOrConfiguredUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export { DEFAULT_BASE_URL, isLoopbackUrl, isValidLoopbackOrConfiguredUrl };
