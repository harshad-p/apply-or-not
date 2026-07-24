const resultElement = document.querySelector("[data-fixture-result]");

if (resultElement && globalThis.ApplyOrNotExtractor) {
  resultElement.textContent = JSON.stringify(
    globalThis.ApplyOrNotExtractor.extract(document),
  );
}
