"use strict";

const extensionApi = globalThis.browser ?? globalThis.chrome;
const presentation = globalThis.ApplyOrNotPresentation;
const analysisDetails = document.querySelector("[data-analysis-details]");
const applicationMethodLabel = document.querySelector(
  "[data-application-method]",
);
const blockerGroup = document.querySelector("[data-blocker-group]");
const blockerList = document.querySelector("[data-blocker-list]");
const concernGroup = document.querySelector("[data-concern-group]");
const concernList = document.querySelector("[data-concern-list]");
const confidenceLabel = document.querySelector("[data-confidence]");
const extractButton = document.querySelector("[data-extract-button]");
const jobLabel = document.querySelector("[data-job-label]");
const languageGroup = document.querySelector("[data-language-group]");
const languageSummary = document.querySelector("[data-language-summary]");
const modelLabel = document.querySelector("[data-model]");
const positiveGroup = document.querySelector("[data-positive-group]");
const positiveList = document.querySelector("[data-positive-list]");
const resultDescription = document.querySelector("[data-result-description]");
const resultEyebrow = document.querySelector("[data-result-eyebrow]");
const resultMark = document.querySelector("[data-result-mark]");
const resultTitle = document.querySelector("[data-result-title]");
const settingsButton = document.querySelector("[data-settings-button]");
const settingsNote = document.querySelector("[data-settings-note]");
const settingsStatus = document.querySelector("[data-settings-status]");
const versionElement = document.querySelector("[data-version]");

let currentSettings = {
  userCriteria: "",
  preferredLanguage: "English",
};

if (versionElement && extensionApi?.runtime?.getManifest) {
  const { version } = extensionApi.runtime.getManifest();
  versionElement.textContent = `v${version}`;
}

async function loadSettingsStatus() {
  try {
    const {
      userCriteria = "",
      preferredLanguage = "English",
    } = await extensionApi.storage.local.get([
      "userCriteria",
      "preferredLanguage",
    ]);
    currentSettings = { userCriteria, preferredLanguage };
    const isConfigured = userCriteria.trim().length > 0;

    settingsStatus.textContent = isConfigured ? "Ready" : "Setup needed";
    settingsStatus.dataset.state = isConfigured ? "configured" : "pending";
    extractButton.hidden = !isConfigured;
    settingsButton.textContent = isConfigured
      ? "Edit your preferences"
      : "Set your preferences";
    settingsNote.textContent = isConfigured
      ? "The job description and your preferences will be sent to GPT-5.6 through the local relay."
      : "Tell Apply or Not what you want from a role before analyzing job postings.";
  } catch (error) {
    console.error("Unable to read extension settings.", error);
    settingsStatus.textContent = "Settings unavailable";
    settingsStatus.dataset.state = "error";
    settingsNote.textContent = "Reload the extension and try opening settings again.";
  }
}

function hideAnalysisDetails() {
  analysisDetails.hidden = true;
  for (const list of [positiveList, concernList, blockerList]) {
    list.replaceChildren();
  }
}

function appendEvidenceItems(list, items) {
  const fragment = document.createDocumentFragment();
  for (const item of items) {
    const listItem = document.createElement("li");
    const title = document.createElement("strong");
    const explanation = document.createElement("p");
    const evidence = document.createElement("q");

    title.textContent = item.title;
    explanation.textContent = item.explanation;
    evidence.textContent = item.evidence;
    listItem.append(title, explanation, evidence);
    fragment.append(listItem);
  }
  list.append(fragment);
}

function formatLanguageSummary(analysis) {
  if (!analysis.languageRequirements.length) {
    return `Posting language: ${analysis.postingLanguage}. No explicit language requirement was found.`;
  }

  const requirements = analysis.languageRequirements
    .map(
      ({ language, level, requirement }) =>
        `${language}: ${level} (${requirement})`,
    )
    .join("; ");
  return `Posting language: ${analysis.postingLanguage}. ${requirements}.`;
}

async function setToolbarBadge(tabId, text = "", color = "#526158") {
  if (!extensionApi.action || !tabId) return;
  try {
    await Promise.all([
      extensionApi.action.setBadgeText({ tabId, text }),
      extensionApi.action.setBadgeBackgroundColor({ tabId, color }),
    ]);
  } catch (error) {
    console.warn("Unable to update the toolbar badge.", error);
  }
}

function renderExtraction(extraction) {
  hideAnalysisDetails();
  const { characterCount, source, wasTruncated } = extraction.extraction;
  const detectionScore = extraction.detection.score;

  if (extraction.isLikelyJobPosting) {
    resultMark.textContent = "JD";
    resultMark.dataset.state = "detected";
    resultEyebrow.textContent = "Job posting detected";
    resultTitle.textContent = extraction.job.title || "Job posting found";
    resultDescription.textContent =
      [extraction.job.company, extraction.job.location]
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

  const truncatedNote = wasTruncated
    ? " The text was limited to 50,000 characters."
    : "";
  settingsNote.textContent = `${detectionScore}/100 page evidence · ${characterCount.toLocaleString()} characters read from ${source}.${truncatedNote}`;
}

function renderAnalysis(analysis, extraction, tabId) {
  const recommendation = presentation.getRecommendationPresentation(
    analysis.recommendation,
  );

  resultMark.textContent = String(analysis.score);
  resultMark.dataset.state = recommendation.state;
  resultEyebrow.textContent = `${recommendation.symbol} ${recommendation.label}`;
  resultTitle.textContent = `${recommendation.label} — ${analysis.score}%`;
  resultDescription.textContent = analysis.summary;
  jobLabel.textContent = [extraction.job.title, extraction.job.company]
    .filter(Boolean)
    .join(" · ");
  confidenceLabel.textContent = presentation.formatConfidence(analysis.confidence);
  modelLabel.textContent = presentation.formatModelLabel(analysis.provider.model);
  applicationMethodLabel.textContent = presentation.formatApplicationMethod(
    extraction.job.application,
  );

  positiveGroup.hidden = analysis.positiveMatches.length === 0;
  concernGroup.hidden = analysis.concerns.length === 0;
  blockerGroup.hidden = analysis.hardBlockers.length === 0;
  languageGroup.hidden = false;
  appendEvidenceItems(positiveList, analysis.positiveMatches);
  appendEvidenceItems(concernList, analysis.concerns);
  appendEvidenceItems(blockerList, analysis.hardBlockers);
  languageSummary.textContent = formatLanguageSummary(analysis);
  analysisDetails.hidden = false;

  settingsStatus.textContent = "Analyzed";
  settingsStatus.dataset.state = recommendation.state;
  settingsNote.textContent = `Validated ${analysis.promptVersion} result · ${presentation.formatModelLabel(analysis.provider.model)} · response ${analysis.provider.responseId || "not supplied"}`;
  extractButton.textContent = "Analyze this job again";
  setToolbarBadge(
    tabId,
    String(analysis.score),
    recommendation.badgeColor,
  );
}

function renderExtractionError(error, tabId) {
  console.error("Unable to extract the current page.", error);
  hideAnalysisDetails();
  resultMark.textContent = "!";
  resultMark.dataset.state = "error";
  resultEyebrow.textContent = "Page unavailable";
  resultTitle.textContent = "This page could not be read";
  resultDescription.textContent =
    "Open a normal web page and allow temporary access if Safari asks, then try again.";
  settingsNote.textContent =
    "Browser settings pages and other protected pages cannot be analyzed.";
  setToolbarBadge(tabId, "!", "#a84035");
}

function renderAnalysisError(error, extraction, tabId) {
  console.error("Unable to analyze the job posting.", error);
  hideAnalysisDetails();
  resultMark.textContent = "!";
  resultMark.dataset.state = "error";
  resultEyebrow.textContent = "Analysis unavailable";
  resultTitle.textContent = "GPT-5.6 could not analyze this job";
  resultDescription.textContent = error.message;
  settingsNote.textContent = `${extraction.extraction.characterCount.toLocaleString()} characters were extracted successfully. Make sure the local relay is running, then retry.`;
  extractButton.textContent = "Try analysis again";
  setToolbarBadge(tabId, "!", "#a84035");
}

async function requestAnalysis(extraction) {
  const response = await extensionApi.runtime.sendMessage({
    type: "analysis:run",
    payload: {
      userCriteria: currentSettings.userCriteria,
      preferredLanguage: currentSettings.preferredLanguage,
      job: extraction.job,
    },
  });

  if (!response?.ok) {
    throw new Error(response?.error || "The local AI helper did not respond.");
  }
  return response.result;
}

async function extractCurrentPage() {
  extractButton.disabled = true;
  extractButton.textContent = "Reading page…";
  resultEyebrow.textContent = "Local extraction";
  resultTitle.textContent = "Reading the current page";
  resultDescription.textContent =
    "Looking for structured job data and visible description text.";
  resultMark.textContent = "…";
  resultMark.dataset.state = "";
  hideAnalysisDetails();

  let activeTab;
  try {
    [activeTab] = await extensionApi.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!activeTab?.id) {
      throw new Error("No active browser tab is available.");
    }

    await setToolbarBadge(activeTab.id);
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

    const extraction = injectionResult.result;
    renderExtraction(extraction);
    if (!extraction.isLikelyJobPosting) {
      extractButton.textContent = "Read this page again";
      await setToolbarBadge(activeTab.id, "?", "#b46b12");
      return;
    }

    extractButton.textContent = "Analyzing with GPT-5.6…";
    resultEyebrow.textContent = "GPT-5.6 analysis";
    resultTitle.textContent = "Evaluating your fit";
    resultDescription.textContent =
      "Comparing the posting with your saved preferences.";
    resultMark.textContent = "…";
    resultMark.dataset.state = "";

    try {
      const analysis = await requestAnalysis(extraction);
      renderAnalysis(analysis, extraction, activeTab.id);
    } catch (error) {
      renderAnalysisError(error, extraction, activeTab.id);
    }
  } catch (error) {
    renderExtractionError(error, activeTab?.id);
  } finally {
    extractButton.disabled = false;
    if (
      extractButton.textContent === "Reading page…" ||
      extractButton.textContent === "Analyzing with GPT-5.6…"
    ) {
      extractButton.textContent = "Try again";
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
