const extensionApi = globalThis.browser ?? globalThis.chrome;
const versionElement = document.querySelector("[data-version]");

if (versionElement && extensionApi?.runtime?.getManifest) {
  const { version } = extensionApi.runtime.getManifest();
  versionElement.textContent = `v${version}`;
}
