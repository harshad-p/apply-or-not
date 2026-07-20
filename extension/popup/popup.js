const extensionApi = globalThis.browser ?? globalThis.chrome;
const versionElement = document.querySelector("[data-version]");
const settingsButton = document.querySelector("[data-settings-button]");
const settingsNote = document.querySelector("[data-settings-note]");
const settingsStatus = document.querySelector("[data-settings-status]");

if (versionElement && extensionApi?.runtime?.getManifest) {
  const { version } = extensionApi.runtime.getManifest();
  versionElement.textContent = `v${version}`;
}

async function loadSettingsStatus() {
  try {
    const { userCriteria = "" } = await extensionApi.storage.local.get([
      "userCriteria",
    ]);
    const isConfigured = userCriteria.trim().length > 0;

    settingsStatus.textContent = isConfigured ? "Preferences saved" : "Setup needed";
    settingsStatus.dataset.state = isConfigured ? "configured" : "pending";
    settingsButton.textContent = isConfigured
      ? "Edit your preferences"
      : "Set your preferences";
    settingsNote.textContent = isConfigured
      ? "Your preferences are stored locally. Job-page analysis comes next."
      : "Tell Apply or Not what you want from a role before analyzing job postings.";
  } catch (error) {
    console.error("Unable to read extension settings.", error);
    settingsStatus.textContent = "Settings unavailable";
    settingsStatus.dataset.state = "error";
    settingsNote.textContent = "Reload the extension and try opening settings again.";
  }
}

settingsButton?.addEventListener("click", async () => {
  try {
    await extensionApi.runtime.openOptionsPage();
    window.close();
  } catch (error) {
    console.error("Unable to open the settings page.", error);
    settingsStatus.textContent = "Could not open settings";
    settingsStatus.dataset.state = "error";
  }
});

loadSettingsStatus();
