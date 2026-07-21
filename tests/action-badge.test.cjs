const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createBadgeUpdater,
} = require("../extension/shared/action-badge.js");

test("applies badge updates in request order so an error replaces an old score", async () => {
  const state = { text: "", color: "" };
  const delay = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds));
  const actionApi = {
    async setBadgeText({ text }) {
      await delay(text === "100" ? 15 : 0);
      state.text = text;
    },
    async setBadgeBackgroundColor({ color }) {
      await delay(color === "green" ? 15 : 0);
      state.color = color;
    },
  };
  const updateBadge = createBadgeUpdater(actionApi);

  const oldScore = updateBadge(7, "100", "green");
  const newerError = updateBadge(7, "!", "red");
  await Promise.all([oldScore, newerError]);

  assert.deepEqual(state, { text: "!", color: "red" });
});
