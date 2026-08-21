const extensionApi = globalThis.browser ?? globalThis.chrome;
const form = document.querySelector("[data-settings-form]");
const criteriaInput = document.querySelector("#user-criteria");
const languageInput = document.querySelector("#preferred-language");
const providerInput = document.querySelector("[data-provider]");
const customSettings = document.querySelector("[data-custom-settings]");
const customServerUrlInput = document.querySelector("[data-custom-server-url]");
const keySettings = document.querySelector("[data-key-settings]");
const keyLabel = document.querySelector("[data-key-label]");
const keyDescription = document.querySelector("[data-key-description]");
const characterCount = document.querySelector("[data-character-count]");
const apiKeyInput = document.querySelector("[data-api-key]");
const connectKeyButton = document.querySelector("[data-connect-key-button]");
const connectionStatus = document.querySelector("[data-connection-status]");
const clearButton = document.querySelector("[data-clear-button]");
const saveButton = document.querySelector("[data-save-button]");
const saveStatus = document.querySelector("[data-save-status]");
const DEFAULT_CUSTOM_SERVER_URL = "http://127.0.0.1:8788";

function updateCharacterCount() {
  characterCount.textContent = `${criteriaInput.value.length.toLocaleString()} / 8,000`;
}

function showStatus(message, state = "success") {
  saveStatus.textContent = message;
  saveStatus.dataset.state = state;
}

function markSettingsDirty() {
  saveButton.textContent = "Save preferences";
  showStatus("");
}

function showConnectionStatus(message, state = "") {
  connectionStatus.textContent = message;
  connectionStatus.dataset.state = state;
}

function updateProviderVisibility() {
  const provider = providerInput.value;
  const isCustom = provider === "custom";
  const isOpenAI = provider === "openai";
  const isFree = provider === "free";

  customSettings.hidden = !isCustom;
  customServerUrlInput.required = isCustom;

  // Show key input for OpenAI (always) and for free tier only when relay
  // reports no server key. For simplicity, always show for both —
  // checkRelayStatus will add context about whether a key is needed.
  keySettings.hidden = isCustom;

  if (isFree) {
    keyLabel.textContent = "Free tier API key (optional override)";
    keyDescription.textContent =
      "A server key is already configured for the free tier. You can paste your own Groq key here to use it instead for this session.";
  } else {
    keyLabel.textContent = "OpenAI API key";
    keyDescription.textContent =
      "Enter your key to use OpenAI for analysis. The relay holds it in memory only — it is never saved to browser storage.";
  }
}

async function checkRelayStatus() {
  try {
    const response = await extensionApi.runtime.sendMessage({
      type: "analysis:health",
    });
    if (!response?.ok) throw new Error(response?.error || "Relay unavailable.");
    const { providers = {} } = response.result;
    const provider = providerInput.value;

    if (provider === "free") {
      const freeConfigured = providers.free?.configured === true;
      const serverKey = providers.free?.serverKey === true;
      showConnectionStatus(
        freeConfigured
          ? serverKey
            ? "Relay connected · Free tier ready (server key active)."
            : "Relay connected · Free tier ready (session key active)."
          : "Relay connected · No key configured for free tier.",
        freeConfigured ? "configured" : "",
      );
    } else if (provider === "openai") {
      const openAiConfigured = providers.openai?.configured === true;
      showConnectionStatus(
        openAiConfigured
          ? "Relay connected · OpenAI configured for this session."
          : "Relay connected · API key still needed.",
        openAiConfigured ? "configured" : "",
      );
    } else if (provider === "custom") {
      showConnectionStatus(
        "Relay connected · Custom server URL will be used for analysis.",
        "configured",
      );
    }
  } catch {
    showConnectionStatus(
      "Relay is not running. Start node local-relay/server.mjs first.",
      "error",
    );
  }
}

async function restoreSettings() {
  try {
    const {
      userCriteria = "",
      preferredLanguage = "English",
      analysisProvider = "free",
      customServerUrl = DEFAULT_CUSTOM_SERVER_URL,
    } = await extensionApi.storage.local.get([
      "userCriteria",
      "preferredLanguage",
      "analysisProvider",
      "customServerUrl",
    ]);

    criteriaInput.value = userCriteria;
    languageInput.value = preferredLanguage;
    providerInput.value = analysisProvider;
    customServerUrlInput.value = customServerUrl;
    updateProviderVisibility();
    updateCharacterCount();
    await checkRelayStatus();
  } catch (error) {
    console.error("Unable to load extension settings.", error);
    showStatus("Could not load your saved preferences.", "error");
  }
}

criteriaInput.addEventListener("input", () => {
  criteriaInput.setCustomValidity("");
  updateCharacterCount();
  markSettingsDirty();
});

languageInput.addEventListener("input", () => {
  languageInput.setCustomValidity("");
  markSettingsDirty();
});

providerInput.addEventListener("change", () => {
  updateProviderVisibility();
  markSettingsDirty();
  checkRelayStatus();
});

customServerUrlInput.addEventListener("input", () => {
  customServerUrlInput.setCustomValidity("");
  markSettingsDirty();
});

connectKeyButton.addEventListener("click", async () => {
  const apiKey = apiKeyInput.value.trim();
  const provider = providerInput.value === "free" ? "free" : "openai";
  const minLength = 20;
  const keyError =
    provider === "free"
      ? "Enter a valid Groq API key."
      : "Enter a valid OpenAI API key.";

  apiKeyInput.setCustomValidity(apiKey.length >= minLength ? "" : keyError);
  if (!apiKeyInput.reportValidity()) return;

  connectKeyButton.disabled = true;
  connectKeyButton.textContent = "Connecting…";
  showConnectionStatus("Sending the key to the local relay…");

  try {
    const response = await extensionApi.runtime.sendMessage({
      type: "analysis:key:set",
      apiKey,
      provider,
    });
    if (!response?.ok) throw new Error(response?.error || "Relay unavailable.");
    apiKeyInput.value = "";
    showConnectionStatus(
      "Connected. The key is held only in relay memory.",
      "configured",
    );
  } catch (error) {
    showConnectionStatus(error.message, "error");
  } finally {
    connectKeyButton.disabled = false;
    connectKeyButton.textContent = "Connect key";
  }
});

apiKeyInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    connectKeyButton.click();
  }
});

clearButton.addEventListener("click", async () => {
  const shouldClear = window.confirm(
    "Clear your saved job criteria, explanation language, and cached results?",
  );

  if (!shouldClear) {
    return;
  }

  clearButton.disabled = true;
  showStatus("");

  try {
    await extensionApi.storage.local.remove([
      "userCriteria",
      "preferredLanguage",
      "analysisProvider",
      "customServerUrl",
      "settingsVersion",
      "analysisCacheV1",
      "analysisRunsV1",
      "localPreferenceProfile",
    ]);
    criteriaInput.value = "";
    languageInput.value = "English";
    providerInput.value = "free";
    customServerUrlInput.value = DEFAULT_CUSTOM_SERVER_URL;
    updateProviderVisibility();
    criteriaInput.setCustomValidity("");
    languageInput.setCustomValidity("");
    updateCharacterCount();
    saveButton.textContent = "Save preferences";
    showStatus("Preferences and saved results cleared.");
    await checkRelayStatus();
  } catch (error) {
    console.error("Unable to clear extension settings.", error);
    showStatus("Could not clear your preferences. Please try again.", "error");
  } finally {
    clearButton.disabled = false;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const userCriteria = criteriaInput.value.trim();
  const preferredLanguage = languageInput.value.trim();
  const analysisProvider = providerInput.value;
  const customServerUrl = customServerUrlInput.value.trim();

  criteriaInput.setCustomValidity(
    userCriteria ? "" : "Describe what you want from a job.",
  );
  languageInput.setCustomValidity(
    preferredLanguage ? "" : "Enter your preferred explanation language.",
  );
  customServerUrlInput.setCustomValidity(
    analysisProvider !== "custom" ||
      /^https?:\/\//iu.test(customServerUrl)
      ? ""
      : "Enter a valid server URL (http or https).",
  );

  if (!form.reportValidity()) {
    return;
  }

  saveButton.disabled = true;
  saveButton.textContent = "Saving…";
  showStatus("");

  try {
    await extensionApi.storage.local.set({
      userCriteria,
      preferredLanguage,
      analysisProvider,
      customServerUrl,
      settingsVersion: 5,
    });
    await extensionApi.storage.local.remove(["localPreferenceProfile"]);
    criteriaInput.value = userCriteria;
    languageInput.value = preferredLanguage;
    updateCharacterCount();
    saveButton.textContent = "Saved ✓";
    showStatus("Preferences saved locally.");
  } catch (error) {
    console.error("Unable to save extension settings.", error);
    showStatus("Could not save your preferences. Please try again.", "error");
  } finally {
    saveButton.disabled = false;
  }
});

updateCharacterCount();
restoreSettings();
