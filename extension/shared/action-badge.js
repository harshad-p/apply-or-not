(() => {
  "use strict";

  function createBadgeUpdater(actionApi) {
    const pendingByTab = new Map();

    return function updateBadge(tabId, text = "", color = "#526158") {
      if (!actionApi || !tabId) return Promise.resolve();

      const previous = pendingByTab.get(tabId) || Promise.resolve();
      const current = previous.catch(() => {}).then(() =>
        Promise.all([
          actionApi.setBadgeText({ tabId, text }),
          actionApi.setBadgeBackgroundColor({ tabId, color }),
        ]),
      );
      pendingByTab.set(tabId, current);

      return current.finally(() => {
        if (pendingByTab.get(tabId) === current) pendingByTab.delete(tabId);
      });
    };
  }

  const api = Object.freeze({ createBadgeUpdater });

  if (typeof globalThis === "object") {
    globalThis.ApplyOrNotBadge = api;
  }

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
})();
