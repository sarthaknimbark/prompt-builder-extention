document.getElementById("openApp").addEventListener("click", () => {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
    return;
  }

  chrome.tabs.create({ url: chrome.runtime.getURL("app.html") });
});
