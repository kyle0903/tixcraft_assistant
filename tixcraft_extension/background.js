// === 拓元搶票助手 - 背景腳本 ===

// 擴充功能安裝時執行
chrome.runtime.onInstalled.addListener(() => {
  console.log("拓元搶票助手已安裝");

  // 設定預設值
  chrome.storage.sync.set({
    autoGrab: false,
    autoSelectTicket: false,
    keywords: [],
    ticketCount: "1",
    autoSubmit: false,
  });
});

// 監聽標籤頁更新
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 當頁面完全載入且是拓元網站時
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    tab.url.includes("tixcraft.com")
  ) {
    console.log("拓元網站頁面已載入:", tab.url);

    // 可以在這裡添加額外的邏輯，例如通知內容腳本
    chrome.tabs
      .sendMessage(tabId, {
        action: "pageLoaded",
        url: tab.url,
      })
      .catch(() => {
        // 忽略錯誤，可能內容腳本還未載入
      });
  }
});

// 處理來自內容腳本的訊息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("背景腳本收到訊息:", request);

  switch (request.action) {
    case "showNotification":
      // 顯示桌面通知
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon_128.png",
        title: "拓元搶票助手",
        message: request.message,
      });
      break;

    case "openNewTab":
      // 開啟新標籤頁
      chrome.tabs.create({
        url: request.url,
        active: true,
      });
      break;

    case "logActivity":
      // 記錄活動日誌
      console.log(`[${new Date().toLocaleTimeString()}] ${request.message}`);
      break;

    default:
      console.log("未知的背景腳本動作:", request.action);
  }

  sendResponse({ success: true });
});
