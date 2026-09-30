chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !/^https:\/\/(?:x|twitter)\.com\//.test(tab.url || "")) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "toggle-panel" });
  } catch {
    // The page may not have loaded its content script yet.
  }
});
