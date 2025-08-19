// === 拓元搶票助手 - 彈出視窗腳本 ===

// 載入已儲存的設定
async function loadSettings() {
  try {
    const config = await ConfigManager.getConfig();

    // API 設定
    document.getElementById("apiUrl").value = config.apiUrl || "";
    document.getElementById("apiKey").value = config.apiKey || "";

    // 自動搶票設定
    document.getElementById("autoRedirect").checked =
      config.autoRedirect || false;
    document.getElementById("autoGrab").checked = config.autoGrab || false;
    document.getElementById("autoSelectTicket").checked =
      config.autoSelectTicket || false;

    // 票種篩選
    const keywordsValue = Array.isArray(config.keywords)
      ? config.keywords.join(",")
      : config.keywords || "";
    document.getElementById("keywords").value = keywordsValue;

    // 購票設定
    document.getElementById("ticketCount").value = config.ticketCount || "1";
    document.getElementById("autoSubmit").checked = config.autoSubmit || false;
  } catch (error) {
    console.error("載入設定失敗:", error);
  }
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
document
  .getElementById("saveSettings")
  .addEventListener("click", async function () {
    try {
      // 處理關鍵字
      const keywordsText = document.getElementById("keywords").value.trim();
      const keywords = keywordsText
        ? keywordsText
            .split(",")
            .map((k) => k.trim())
            .filter((k) => k)
        : [];

      const newConfig = {
        // API 設定
        apiUrl: document.getElementById("apiUrl").value.trim(),
        apiKey: document.getElementById("apiKey").value.trim(),

        // 自動搶票設定
        autoRedirect: document.getElementById("autoRedirect").checked,
        autoGrab: document.getElementById("autoGrab").checked,
        autoSelectTicket: document.getElementById("autoSelectTicket").checked,

        // 票種和購票設定
        keywords: keywords,
        ticketCount: document.getElementById("ticketCount").value,
        autoSubmit: document.getElementById("autoSubmit").checked,
      };

      const testApiResult = document.getElementById("testApiResult");
      if (document.getElementById("testApi").click()) {
        const response = await fetch(`${newConfig.apiUrl}/health`, {
          headers: {
            "X-API-Key": newConfig.apiKey,
          },
        });

        if (!response.ok) {
          testApiResult.textContent =
            "API 連線測試失敗，請檢查 API Key 是否正確";
          testApiResult.style.color = "#f44336";
          return;
        }

        const result = await response.json();
        if (result.message !== "OK") {
          testApiResult.textContent =
            "API 連線測試失敗，請檢查 API Key 是否正確";
          testApiResult.style.color = "#f44336";
          return;
        }

        testApiResult.textContent = "API 連線測試成功";
        testApiResult.style.color = "#4caf50";
      }

      // 驗證設定
      const errors = ConfigManager.validateConfig(newConfig);
      if (errors.length > 0) {
        const status = document.getElementById("status");
        status.textContent = "❌ " + errors.join(", ");
        status.style.color = "#f44336";
        setTimeout(() => {
          status.textContent = "";
          status.style.color = "#4caf50";
        }, 3000);
        return;
      }

      // 儲存設定
      await ConfigManager.saveConfig(newConfig);

      const status = document.getElementById("status");
      status.textContent = "✅ 設定已儲存！";

      // 通知內容腳本更新設定
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0] && tabs[0].url.includes("tixcraft.com")) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: "updateSettings",
            settings: newConfig,
          });
        }
      });

      setTimeout(() => {
        status.textContent = "";
        loadStatus(); // 重新載入狀態
      }, 2000);
    } catch (error) {
      console.error("儲存設定失敗:", error);
      const status = document.getElementById("status");
      status.textContent = "❌ 儲存失敗！";
      status.style.color = "#f44336";
    }
  });

// 停止所有自動化
document.getElementById("stopAll").addEventListener("click", async function () {
  try {
    const stopConfig = {
      autoRedirect: false,
      autoGrab: false,
      autoSelectTicket: false,
      autoSubmit: false,
    };

    await ConfigManager.saveConfig(stopConfig);

    // 更新 UI
    document.getElementById("autoRedirect").checked = false;
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
          settings: stopConfig,
        });
      }
    });

    setTimeout(() => {
      status.textContent = "";
      loadStatus();
    }, 2000);
  } catch (error) {
    console.error("停止自動化失敗:", error);
  }
});

// 頁面載入時執行
document.addEventListener("DOMContentLoaded", function () {
  loadSettings();
  loadStatus();

  // 每3秒更新一次狀態
  setInterval(loadStatus, 3000);
});
