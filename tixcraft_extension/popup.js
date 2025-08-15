// === 拓元搶票助手 - 彈出視窗腳本 ===

// 載入已儲存的設定
function loadSettings() {
  chrome.storage.sync.get(
    ["autoGrab", "autoSelectTicket", "keywords", "ticketCount", "autoSubmit"],
    function (result) {
      // 自動搶票設定
      document.getElementById("autoGrab").checked = result.autoGrab || false;
      document.getElementById("autoSelectTicket").checked =
        result.autoSelectTicket || false;

      // 票種篩選
      document.getElementById("keywords").value = result.keywords
        ? result.keywords.join(",")
        : "";

      // 購票設定
      document.getElementById("ticketCount").value = result.ticketCount || "1";
      document.getElementById("autoSubmit").checked =
        result.autoSubmit || false;
    }
  );
}

// 載入目前狀態
function loadStatus() {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs[0] && tabs[0].url.includes("tixcraft.com")) {
      chrome.tabs.sendMessage(
        tabs[0].id,
        { action: "getStatus" },
        function (response) {
          const statusDiv = document.getElementById("currentStatus");
          if (response) {
            statusDiv.innerHTML = `
            <div>頁面類型: ${getPageTypeName(response.pageType)}</div>
            <div>運行狀態: ${response.isRunning ? "🔄 執行中" : "⏸️ 待命"}</div>
            <div>自動搶票: ${
              response.settings.autoGrab ? "✅ 啟用" : "❌ 停用"
            }</div>
          `;
          } else {
            statusDiv.textContent = "請在拓元網站頁面中使用";
          }
        }
      );
    } else {
      document.getElementById("currentStatus").textContent =
        "請前往拓元網站使用此擴充功能";
    }
  });
}

function getPageTypeName(pageType) {
  const names = {
    activity_detail: "活動詳情頁",
    activity_game: "場次選擇頁",
    ticket_area: "票種選擇頁",
    ticket_purchase: "購票頁面",
    unknown: "未知頁面",
  };
  return names[pageType] || "未知";
}

// 儲存設定
document.getElementById("saveSettings").addEventListener("click", function () {
  const keywordsText = document.getElementById("keywords").value.trim();
  const keywords = keywordsText
    ? keywordsText
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k)
    : [];

  const settings = {
    autoGrab: document.getElementById("autoGrab").checked,
    autoSelectTicket: document.getElementById("autoSelectTicket").checked,
    keywords: keywords,
    ticketCount: document.getElementById("ticketCount").value,
    autoSubmit: document.getElementById("autoSubmit").checked,
  };

  chrome.storage.sync.set(settings, function () {
    const status = document.getElementById("status");
    status.textContent = "✅ 設定已儲存！";

    // 通知內容腳本更新設定
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0] && tabs[0].url.includes("tixcraft.com")) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "updateSettings",
          settings: settings,
        });
      }
    });

    setTimeout(() => {
      status.textContent = "";
      loadStatus(); // 重新載入狀態
    }, 2000);
  });
});

// 停止所有自動化
document.getElementById("stopAll").addEventListener("click", function () {
  const settings = {
    autoGrab: false,
    autoSelectTicket: false,
    autoSubmit: false,
  };

  chrome.storage.sync.set(settings, function () {
    // 更新 UI
    document.getElementById("autoGrab").checked = false;
    document.getElementById("autoSelectTicket").checked = false;
    document.getElementById("autoSubmit").checked = false;

    const status = document.getElementById("status");
    status.textContent = "⏹️ 已停止所有自動化功能";

    // 通知內容腳本
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0] && tabs[0].url.includes("tixcraft.com")) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "updateSettings",
          settings: settings,
        });
      }
    });

    setTimeout(() => {
      status.textContent = "";
      loadStatus();
    }, 2000);
  });
});

// 頁面載入時執行
document.addEventListener("DOMContentLoaded", function () {
  loadSettings();
  loadStatus();

  // 每3秒更新一次狀態
  setInterval(loadStatus, 3000);
});
