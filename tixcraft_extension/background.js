chrome.runtime.onInstalled.addListener(() => {
  console.log("拓元搶票助手已安裝");
  // 設定預設值
  chrome.storage.sync.set({
    apiUrl: "https://tixcraft-api-729408356870.asia-east1.run.app",
    apiKey: "",
    timeout: 30000,
    retryCount: 3,
    autoRedirect: false,
    autoGrab: false,
    autoSelectTicket: false,
    keywords: [],
    ticketCount: "1",
    autoSubmit: false,
    allowLessTickets: false,
  });
});

// 監聽標籤頁更新，當頁面完全載入且是拓元網站時
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 判斷頁面只有是拓元網站時才會執行，避免其他網站也執行
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    tab.url.includes("tixcraft.com")
  ) {
    console.log("拓元網站頁面已載入:", tab.url);

    // 檢查使用者是否啟用自動跳轉
    chrome.storage.sync.get(["autoRedirect"], (result) => {
      if (result.autoRedirect && tab.url.includes("detail")) {
        console.log("自動跳轉已啟用，將活動頁面跳轉到場次頁面");
        chrome.tabs.update(tabId, { url: tab.url.replace("detail", "game") });
      }
    });
  }
});
