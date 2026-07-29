const extensionApi = globalThis.browser ?? globalThis.chrome;
const form = document.querySelector("[data-settings-form]");
const criteriaInput = document.querySelector("#user-criteria");
const languageInput = document.querySelector("#preferred-language");
const providerInput = document.querySelector("[data-provider]");
const localSettings = document.querySelector("[data-local-settings]");
const localBaseUrlInput = document.querySelector("[data-local-base-url]");
const localModelInput = document.querySelector("[data-local-model]");
const localLanguageModelInput = document.querySelector(
  "[data-local-language-model]",
);
const openAISettings = document.querySelector("[data-openai-settings]");
const characterCount = document.querySelector("[data-character-count]");
const apiKeyInput = document.querySelector("[data-api-key]");
const connectKeyButton = document.querySelector("[data-connect-key-button]");
const connectionStatus = document.querySelector("[data-connection-status]");
const clearButton = document.querySelector("[data-clear-button]");
const saveButton = document.querySelector("[data-save-button]");
const saveStatus = document.querySelector("[data-save-status]");
const DEFAULT_LOCAL_BASE_URL = "http://127.0.0.1:11434/v1";

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
  const isLocal = providerInput.value === "local";
  localSettings.hidden = !isLocal;
  openAISettings.hidden = isLocal;
  localBaseUrlInput.required = isLocal;
  localModelInput.required = isLocal;
}

async function checkRelayStatus() {
  try {
    const response = await extensionApi.runtime.sendMessage({
      type: "analysis:health",
    });
    if (!response?.ok) throw new Error(response?.error || "Relay unavailable.");
    const openAIConfigured =
      response.result.providers?.openai?.configured === true;
    if (providerInput.value === "local") {
      showConnectionStatus(
        "Relay connected · local model settings will be used for analysis.",
        "configured",
      );
    } else {
      showConnectionStatus(
        openAIConfigured
          ? "Relay connected · OpenAI configured for this session."
          : "Relay connected · API key still needed.",
        openAIConfigured ? "configured" : "",
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
      analysisProvider = "openai",
      localBaseUrl = DEFAULT_LOCAL_BASE_URL,
      localModel = "",
      localLanguageModel = "",
    } = await extensionApi.storage.local.get([
      "userCriteria",
      "preferredLanguage",
      "analysisProvider",
      "localBaseUrl",
      "localModel",
      "localLanguageModel",
    ]);

    criteriaInput.value = userCriteria;
    languageInput.value = preferredLanguage;
    providerInput.value = analysisProvider;
    localBaseUrlInput.value = localBaseUrl;
    localModelInput.value = localModel;
    localLanguageModelInput.value = localLanguageModel;
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

for (const input of [
  localBaseUrlInput,
  localModelInput,
  localLanguageModelInput,
]) {
  input.addEventListener("input", () => {
    input.setCustomValidity("");
    markSettingsDirty();
  });
}

connectKeyButton.addEventListener("click", async () => {
  const apiKey = apiKeyInput.value.trim();
  apiKeyInput.setCustomValidity(
    apiKey.length >= 20 ? "" : "Enter a valid OpenAI API key.",
  );
  if (!apiKeyInput.reportValidity()) return;

  connectKeyButton.disabled = true;
  connectKeyButton.textContent = "Connecting…";
  showConnectionStatus("Sending the key to the local relay…");

  try {
    const response = await extensionApi.runtime.sendMessage({
      type: "analysis:key:set",
      apiKey,
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
      "localBaseUrl",
      "localModel",
      "localLanguageModel",
      "settingsVersion",
      "analysisCacheV1",
      "analysisRunsV1",
    ]);
    criteriaInput.value = "";
    languageInput.value = "English";
    providerInput.value = "openai";
    localBaseUrlInput.value = DEFAULT_LOCAL_BASE_URL;
    localModelInput.value = "";
    localLanguageModelInput.value = "";
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
  const localBaseUrl = localBaseUrlInput.value.trim();
  const localModel = localModelInput.value.trim();
  const localLanguageModel = localLanguageModelInput.value.trim();

  criteriaInput.setCustomValidity(
    userCriteria ? "" : "Describe what you want from a job.",
  );
  languageInput.setCustomValidity(
    preferredLanguage ? "" : "Enter your preferred explanation language.",
  );
  localBaseUrlInput.setCustomValidity(
    analysisProvider !== "local" ||
      /^http:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?(?:\/|$)/iu.test(
        localBaseUrl,
      )
      ? ""
      : "Use an HTTP localhost or loopback URL.",
  );
  localModelInput.setCustomValidity(
    analysisProvider !== "local" || localModel
      ? ""
      : "Enter the local model identifier.",
  );

  if (!form.reportValidity()) {
    return;
  }

  saveButton.disabled = true;
  saveButton.textContent = "Saving…";
  showStatus("");
  let saved = false;

  try {
    await extensionApi.storage.local.set({
      userCriteria,
      preferredLanguage,
      analysisProvider,
      localBaseUrl,
      localModel,
      localLanguageModel,
      settingsVersion: 3,
    });
    criteriaInput.value = userCriteria;
    languageInput.value = preferredLanguage;
    updateCharacterCount();
    saved = true;
    saveButton.textContent = "Saved ✓";
    showStatus("Preferences saved locally.");
  } catch (error) {
    console.error("Unable to save extension settings.", error);
    showStatus("Could not save your preferences. Please try again.", "error");
  } finally {
    saveButton.disabled = false;
    if (!saved) {
      saveButton.textContent = "Save preferences";
    }
  }
});

updateCharacterCount();
restoreSettings();
