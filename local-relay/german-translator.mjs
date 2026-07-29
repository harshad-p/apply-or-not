const DEFAULT_TRANSLATION_MODEL = "onnx-community/opus-mt-de-en";
const MAX_TRANSLATION_CHUNK_LENGTH = 500;

let translationPipelinePromise;

function splitLongText(text, maximumLength = MAX_TRANSLATION_CHUNK_LENGTH) {
  const normalized = String(text || "").trim();
  if (!normalized) return [];
  if (normalized.length <= maximumLength) return [normalized];

  const chunks = [];
  let remaining = normalized;
  while (remaining.length > maximumLength) {
    const candidate = remaining.slice(0, maximumLength + 1);
    const breakAt = Math.max(
      candidate.lastIndexOf("\n"),
      candidate.lastIndexOf(". "),
      candidate.lastIndexOf("; "),
      candidate.lastIndexOf(", "),
      candidate.lastIndexOf(" "),
    );
    const end = breakAt >= maximumLength * 0.5 ? breakAt + 1 : maximumLength;
    chunks.push(remaining.slice(0, end).trim());
    remaining = remaining.slice(end).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

function buildTranslationChunks(text) {
  return String(text || "")
    .split(/\n{2,}/u)
    .flatMap((paragraph) => splitLongText(paragraph))
    .filter(Boolean);
}

function isLikelyGermanPassage(text) {
  const normalized = String(text || "").toLocaleLowerCase();
  if (!normalized) return false;
  if (/[äöüß]/u.test(normalized)) return true;
  if (/(?:deutsch|englisch|sprach|kenntnis|schrift)/u.test(normalized)) {
    return true;
  }
  const signals =
    normalized.match(
      /\b(?:aber|als|auch|bei|der|die|das|den|dem|des|ein|eine|einen|für|gute|guten|im|ist|mit|oder|sehr|sind|und|von|wir|werden|zu|zum|zur)\b/gu,
    ) || [];
  return new Set(signals).size >= 2;
}

async function defaultPipelineFactory() {
  const { pipeline } = await import("@huggingface/transformers");
  return pipeline("translation", DEFAULT_TRANSLATION_MODEL, {
    dtype: "q8",
  });
}

async function getTranslationPipeline(pipelineFactory = defaultPipelineFactory) {
  if (pipelineFactory !== defaultPipelineFactory) {
    return pipelineFactory();
  }
  translationPipelinePromise ||= pipelineFactory();
  return translationPipelinePromise;
}

async function translateGermanToEnglish(
  text,
  { pipelineFactory = defaultPipelineFactory } = {},
) {
  const chunks = buildTranslationChunks(text);
  if (!chunks.length) return "";

  const germanIndexes = chunks
    .map((chunk, index) => (isLikelyGermanPassage(chunk) ? index : -1))
    .filter((index) => index >= 0);
  if (!germanIndexes.length) return chunks.join("\n\n");

  const translator = await getTranslationPipeline(pipelineFactory);
  const germanChunks = germanIndexes.map((index) => chunks[index]);
  const results = await translator(germanChunks, {
    max_new_tokens: 256,
  });
  const translations = (Array.isArray(results) ? results : [results]).map(
    (result, index) => {
      const translated = result?.translation_text;
      if (typeof translated !== "string" || !translated.trim()) {
        throw new Error(
          `German translation returned no text for passage ${index + 1}.`,
        );
      }
      const trimmed = translated.trim();
      const maximumLength = Math.max(germanChunks[index].length * 3, 300);
      if (trimmed.length > maximumLength) {
        throw new Error(
          `German translation expanded passage ${index + 1} unexpectedly.`,
        );
      }
      return trimmed;
    },
  );
  if (translations.length !== germanChunks.length) {
    throw new Error("German translation returned an incomplete result.");
  }
  const translatedByIndex = new Map(
    germanIndexes.map((chunkIndex, index) => [
      chunkIndex,
      translations[index],
    ]),
  );
  return chunks
    .map((chunk, index) => translatedByIndex.get(index) || chunk)
    .join("\n\n");
}

export {
  DEFAULT_TRANSLATION_MODEL,
  MAX_TRANSLATION_CHUNK_LENGTH,
  buildTranslationChunks,
  isLikelyGermanPassage,
  splitLongText,
  translateGermanToEnglish,
};
