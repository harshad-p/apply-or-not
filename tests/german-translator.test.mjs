import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTranslationChunks,
  isLikelyGermanPassage,
  splitLongText,
  translateGermanToEnglish,
} from "../local-relay/german-translator.mjs";

test("splits long translation input without dropping text", () => {
  const input = "Ein langer deutscher Satz. ".repeat(30).trim();
  const chunks = splitLongText(input, 120);

  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length <= 121));
  assert.equal(chunks.join(" ").replace(/\s+/gu, " "), input);
});

test("keeps mixed-language paragraphs as separate translation chunks", () => {
  assert.deepEqual(
    buildTranslationChunks(
      "About the job\n\nSehr gute Deutschkenntnisse\n\nGute Englischkenntnisse",
    ),
    [
      "About the job",
      "Sehr gute Deutschkenntnisse",
      "Gute Englischkenntnisse",
    ],
  );
});

test("routes German passages without translating ordinary English", () => {
  assert.equal(isLikelyGermanPassage("About the job and our team"), false);
  assert.equal(
    isLikelyGermanPassage("Sehr gute Deutschkenntnisse in Wort und Schrift"),
    true,
  );
  assert.equal(isLikelyGermanPassage("Gute Englischkenntnisse"), true);
});

test("translates mixed German and English content through an injected pipeline", async () => {
  let capturedChunks;
  const translated = await translateGermanToEnglish(
    "About the job\n\nSehr gute Deutschkenntnisse\n\nGute Englischkenntnisse",
    {
      pipelineFactory: async () => async (chunks) => {
        capturedChunks = chunks;
        return [
          { translation_text: "Very good German skills" },
          { translation_text: "Good English skills" },
        ];
      },
    },
  );

  assert.equal(capturedChunks.length, 2);
  assert.equal(capturedChunks.includes("About the job"), false);
  assert.equal(
    translated,
    "About the job\n\nVery good German skills\n\nGood English skills",
  );
});
