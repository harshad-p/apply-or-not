const extensionApi = globalThis.browser ?? globalThis.chrome;
const form = document.querySelector("[data-settings-form]");
const criteriaInput = document.querySelector("#user-criteria");
const languageInput = document.querySelector("#preferred-language");
const characterCount = document.querySelector("[data-character-count]");
const clearButton = document.querySelector("[data-clear-button]");
const saveButton = document.querySelector("[data-save-button]");
const saveStatus = document.querySelector("[data-save-status]");

function updateCharacterCount() {
  characterCount.textContent = `${criteriaInput.value.length.toLocaleString()} / 8,000`;
}

function showStatus(message, state = "success") {
  saveStatus.textContent = message;
  saveStatus.dataset.state = state;
}

async function restoreSettings() {
  try {
    const {
      userCriteria = "",
      preferredLanguage = "English",
    } = await extensionApi.storage.local.get([
      "userCriteria",
      "preferredLanguage",
    ]);

    criteriaInput.value = userCriteria;
    languageInput.value = preferredLanguage;
    updateCharacterCount();
  } catch (error) {
    console.error("Unable to load extension settings.", error);
    showStatus("Could not load your saved preferences.", "error");
  }
}

criteriaInput.addEventListener("input", () => {
  criteriaInput.setCustomValidity("");
  updateCharacterCount();
  showStatus("");
});

languageInput.addEventListener("input", () => {
  languageInput.setCustomValidity("");
  showStatus("");
});

clearButton.addEventListener("click", async () => {
  const shouldClear = window.confirm(
    "Clear your saved job criteria and explanation language?",
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
      "settingsVersion",
    ]);
    criteriaInput.value = "";
    languageInput.value = "English";
    criteriaInput.setCustomValidity("");
    languageInput.setCustomValidity("");
    updateCharacterCount();
    showStatus("Preferences cleared.");
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

  criteriaInput.setCustomValidity(
    userCriteria ? "" : "Describe what you want from a job.",
  );
  languageInput.setCustomValidity(
    preferredLanguage ? "" : "Enter your preferred explanation language.",
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
      settingsVersion: 1,
    });
    criteriaInput.value = userCriteria;
    languageInput.value = preferredLanguage;
    updateCharacterCount();
    showStatus("Preferences saved locally.");
  } catch (error) {
    console.error("Unable to save extension settings.", error);
    showStatus("Could not save your preferences. Please try again.", "error");
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Save preferences";
  }
});

updateCharacterCount();
restoreSettings();
