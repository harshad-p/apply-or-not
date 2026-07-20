(() => {
  "use strict";

  const recommendationMap = Object.freeze({
    apply: {
      label: "Apply",
      symbol: "✓",
      state: "apply",
      badgeColor: "#2f7d4a",
    },
    consider: {
      label: "Consider",
      symbol: "!",
      state: "consider",
      badgeColor: "#b46b12",
    },
    skip: {
      label: "Skip",
      symbol: "×",
      state: "skip",
      badgeColor: "#a84035",
    },
  });

  function getRecommendationPresentation(recommendation) {
    return recommendationMap[recommendation] || recommendationMap.consider;
  }

  function formatModelLabel(model) {
    const normalized = String(model || "").toLowerCase();
    if (normalized.startsWith("gpt-5.6-sol")) return "GPT-5.6 Sol";
    if (normalized.startsWith("gpt-5.6-terra")) return "GPT-5.6 Terra";
    if (normalized.startsWith("gpt-5.6-luna")) return "GPT-5.6 Luna";
    return model || "Unknown model";
  }

  function formatConfidence(confidence) {
    const value = String(confidence || "").toLowerCase();
    return `${value.charAt(0).toUpperCase()}${value.slice(1)} confidence`;
  }

  const api = Object.freeze({
    formatConfidence,
    formatModelLabel,
    getRecommendationPresentation,
  });

  if (typeof globalThis === "object") {
    globalThis.ApplyOrNotPresentation = api;
  }

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
})();
