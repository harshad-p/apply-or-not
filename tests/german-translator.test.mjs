import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTranslationChunks,
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

test("translates mixed German and English content through an injected pipeline", async () => {
  let capturedChunks;
  const translated = await translateGermanToEnglish(
    "About the job\n\nSehr gute Deutschkenntnisse\n\nGute Englischkenntnisse",
    {
      pipelineFactory: async () => async (chunks) => {
        capturedChunks = chunks;
        return [
          { translation_text: "About the job" },
          { translation_text: "Very good German skills" },
          { translation_text: "Good English skills" },
        ];
      },
    },
  );

  assert.equal(capturedChunks.length, 3);
  assert.equal(
    translated,
    "About the job\n\nVery good German skills\n\nGood English skills",
  );
});
