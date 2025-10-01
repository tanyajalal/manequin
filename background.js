console.log("🚀 Manequin Extension Background Service initialized")

chrome.runtime.onInstalled.addListener(() => {
  console.log("Manequin Extension installed successfully")
})

chrome.action.onClicked.addListener((tab) => {
  console.log("Extension icon clicked for tab:", tab.id)

  // Send message to content script to toggle sidebar
  chrome.tabs.sendMessage(tab.id, { action: "toggleSidebar" }, (response) => {
    if (chrome.runtime.lastError) {
      console.log("Content script not ready, injecting...")
      // If content script isn't loaded, inject it
      chrome.scripting
        .executeScript({
          target: { tabId: tab.id },
          files: ["supabase.min.js", "content-script.js"],
        })
        .then(() => {
          chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ["sidebar.css"],
          })
          // Try again after injection
          setTimeout(() => {
            chrome.tabs.sendMessage(tab.id, { action: "toggleSidebar" })
          }, 100)
        })
    }
  })
})

// Basic message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Background received message:", request.action)

  if (request.action === "ping") {
    sendResponse({ success: true, message: "Background service is running" })
  }

  return true
})
