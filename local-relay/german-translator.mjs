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

  const translator = await getTranslationPipeline(pipelineFactory);
  const results = await translator(chunks);
  const translations = (Array.isArray(results) ? results : [results]).map(
    (result, index) => {
      const translated = result?.translation_text;
      if (typeof translated !== "string" || !translated.trim()) {
        throw new Error(
          `German translation returned no text for passage ${index + 1}.`,
        );
      }
      return translated.trim();
    },
  );
  if (translations.length !== chunks.length) {
    throw new Error("German translation returned an incomplete result.");
  }
  return translations.join("\n\n");
}

export {
  DEFAULT_TRANSLATION_MODEL,
  MAX_TRANSLATION_CHUNK_LENGTH,
  buildTranslationChunks,
  splitLongText,
  translateGermanToEnglish,
};
