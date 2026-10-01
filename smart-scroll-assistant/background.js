chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(windowFallbackDefaults(), (stored) => {
    chrome.storage.sync.set({ ...windowFallbackDefaults(), ...stored });
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "SMART_SCROLL_COMMAND") {
    return false;
  }

  sendCommandToActiveTab(message.payload)
    .then((response) => sendResponse(response))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});

async function sendCommandToActiveTab(payload) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    throw new Error("No active tab found.");
  }

  try {
    return await chrome.tabs.sendMessage(tab.id, {
      type: "SMART_SCROLL_COMMAND",
      payload
    });
  } catch (error) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["utils.js", "content.js"]
    });

    return chrome.tabs.sendMessage(tab.id, {
      type: "SMART_SCROLL_COMMAND",
      payload
    });
  }
}

function windowFallbackDefaults() {
  return {
    voiceEnabled: false,
    handEnabled: false,
    scrollSpeed: 650,
    sensitivity: 5,
    continuousScrollEnabled: false,
    cameraPreviewEnabled: true
  };
}
