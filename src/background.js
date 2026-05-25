chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "PROMPTFORGE_CHAT_COMPLETION") return false;

  fetch(message.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message.payload)
  })
    .then(async (response) => {
      const text = await response.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (_error) {
        data = { error: { message: text || "The proxy returned a non-JSON response." } };
      }

      sendResponse({
        ok: response.ok,
        status: response.status,
        data
      });
    })
    .catch((error) => {
      sendResponse({
        ok: false,
        status: 0,
        data: {
          error: {
            message: error.message || "The backend proxy is unreachable."
          }
        }
      });
    });

  return true;
});
