const extensionApi = globalThis.browser ?? globalThis.chrome;
const versionElement = document.querySelector("[data-version]");
const extractButton = document.querySelector("[data-extract-button]");
const resultDescription = document.querySelector("[data-result-description]");
const resultEyebrow = document.querySelector("[data-result-eyebrow]");
const resultMark = document.querySelector("[data-result-mark]");
const resultTitle = document.querySelector("[data-result-title]");
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
    extractButton.hidden = !isConfigured;
    settingsButton.textContent = isConfigured
      ? "Edit your preferences"
      : "Set your preferences";
    settingsNote.textContent = isConfigured
      ? "Read the current page locally. LLM analysis comes in a later milestone."
      : "Tell Apply or Not what you want from a role before analyzing job postings.";
  } catch (error) {
    console.error("Unable to read extension settings.", error);
    settingsStatus.textContent = "Settings unavailable";
    settingsStatus.dataset.state = "error";
    settingsNote.textContent = "Reload the extension and try opening settings again.";
  }
}

function renderExtraction(extraction) {
  const { characterCount, source, wasTruncated } = extraction.extraction;

  if (extraction.isLikelyJobPosting) {
    resultMark.textContent = "JD";
    resultMark.dataset.state = "detected";
    resultEyebrow.textContent = "Job posting detected";
    resultTitle.textContent = extraction.job.title || "Job posting found";
    resultDescription.textContent = [
      extraction.job.company,
      extraction.job.location,
    ]
      .filter(Boolean)
      .join(" · ") || "A likely job description was found on this page.";
  } else {
    resultMark.textContent = "?";
    resultMark.dataset.state = "uncertain";
    resultEyebrow.textContent = "Detection uncertain";
    resultTitle.textContent = "This may not be a job posting";
    resultDescription.textContent =
      "Apply or Not could not find enough reliable job-page evidence.";
  }

  const truncatedNote = wasTruncated ? " The text was limited to 50,000 characters." : "";
  settingsNote.textContent = `${characterCount.toLocaleString()} characters read from ${source}.${truncatedNote}`;
  extractButton.textContent = "Read this page again";
}

function renderExtractionError(error) {
  console.error("Unable to extract the current page.", error);
  resultMark.textContent = "!";
  resultMark.dataset.state = "error";
  resultEyebrow.textContent = "Page unavailable";
  resultTitle.textContent = "This page could not be read";
  resultDescription.textContent =
    "Open a normal web page and allow temporary access if Safari asks, then try again.";
  settingsNote.textContent = "Browser settings pages and other protected pages cannot be analyzed.";
}

async function extractCurrentPage() {
  extractButton.disabled = true;
  extractButton.textContent = "Reading page…";
  resultEyebrow.textContent = "Local extraction";
  resultTitle.textContent = "Reading the current page";
  resultDescription.textContent = "Looking for structured job data and visible description text.";
  resultMark.textContent = "…";
  resultMark.dataset.state = "";

  try {
    const [activeTab] = await extensionApi.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!activeTab?.id) {
      throw new Error("No active browser tab is available.");
    }

    await extensionApi.scripting.executeScript({
      target: { tabId: activeTab.id },
      files: ["content/extractor.js"],
    });

    const [injectionResult] = await extensionApi.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: () => globalThis.ApplyOrNotExtractor?.extract(document),
    });

    if (!injectionResult?.result) {
      throw new Error("The page extractor returned no result.");
    }

    renderExtraction(injectionResult.result);
  } catch (error) {
    renderExtractionError(error);
  } finally {
    extractButton.disabled = false;
    if (extractButton.textContent === "Reading page…") {
      extractButton.textContent = "Try reading this page again";
    }
  }
}

extractButton?.addEventListener("click", extractCurrentPage);

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
