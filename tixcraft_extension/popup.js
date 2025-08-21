// === 拓元搶票助手 - 彈出視窗腳本 ===

// 追蹤 API 測試狀態
let apiTestStatus = {
  tested: false,
  success: false,
  apiUrl: "",
  apiKey: "",
};

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

    // 載入 API 測試狀態
    apiTestStatus = {
      tested: config.apiTested || false,
      success: config.apiTestSuccess || false,
      apiUrl: config.apiUrl || "",
      apiKey: config.apiKey || "",
    };

    // 更新 API 測試結果顯示
    updateApiTestDisplay();

    // 更新按鈕狀態
    updateSaveButtonState();
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

      // 更新設定
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

// 測試 API 連線
document.getElementById("testApi").addEventListener("click", async function () {
  const testApiResult = document.getElementById("apiTestResult");
  const testButton = document.getElementById("testApi");

  // 取得當前的 API 設定
  const apiUrl = document.getElementById("apiUrl").value.trim();
  const apiKey = document.getElementById("apiKey").value.trim();

  if (!apiUrl) {
    testApiResult.textContent = "請先設定 API 網址";
    testApiResult.style.color = "#f44336";
    return;
  }

  if (!apiKey) {
    testApiResult.textContent = "請先設定 API Key";
    testApiResult.style.color = "#f44336";
    return;
  }

  // 顯示測試中狀態
  testButton.disabled = true;
  testButton.textContent = " 測試中...";
  testApiResult.textContent = "正在測試 API 連線...";
  testApiResult.style.color = "#2196f3";

  try {
    const response = await fetch(`${apiUrl}/health`, {
      method: "GET",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      timeout: 10000,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    if (result.message === "OK" || result.status === "ok") {
      testApiResult.textContent = "✅ API 連線測試成功";
      testApiResult.style.color = "#4caf50";

      // 更新測試狀態
      apiTestStatus = {
        tested: true,
        success: true,
        apiUrl: apiUrl,
        apiKey: apiKey,
      };

      // 保存測試成功狀態到 ConfigManager
      await ConfigManager.setApiTestResult(true);

      // 更新按鈕狀態
      updateSaveButtonState();
    } else {
      testApiResult.textContent = "❌ API 回應格式不正確";
      testApiResult.style.color = "#f44336";

      // 更新測試狀態
      apiTestStatus = {
        tested: true,
        success: false,
        apiUrl: apiUrl,
        apiKey: apiKey,
      };

      // 保存測試失敗狀態到 ConfigManager
      await ConfigManager.setApiTestResult(false);

      // 更新按鈕狀態
      updateSaveButtonState();
    }
  } catch (error) {
    console.error("API 測試失敗:", error);
    testApiResult.textContent = `❌ 連線失敗，請檢查 API Key 或 API 網址是否正確`;
    testApiResult.style.color = "#f44336";

    // 更新測試狀態
    apiTestStatus = {
      tested: true,
      success: false,
      apiUrl: apiUrl,
      apiKey: apiKey,
    };

    // 保存測試失敗狀態到 ConfigManager
    await ConfigManager.setApiTestResult(false);

    // 更新按鈕狀態
    updateSaveButtonState();
  } finally {
    // 恢復按鈕狀態
    testButton.disabled = false;
    testButton.textContent = "🔌測試 API 連線";
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

// 重置 API 測試狀態
async function resetApiTestStatus() {
  apiTestStatus = {
    tested: false,
    success: false,
    apiUrl: "",
    apiKey: "",
  };

  // 重置 ConfigManager 中的測試狀態
  await ConfigManager.resetApiTestStatus();

  const testApiResult = document.getElementById("apiTestResult");
  testApiResult.textContent = "API 設定已變更，請重新測試連線";
  testApiResult.style.color = "#ff9800";

  // 更新按鈕狀態
  updateSaveButtonState();
}

// 更新 API 測試結果顯示
function updateApiTestDisplay() {
  const testApiResult = document.getElementById("apiTestResult");

  if (apiTestStatus.tested) {
    if (apiTestStatus.success) {
      testApiResult.textContent = "✅ API 連線測試成功";
      testApiResult.style.color = "#4caf50";
    } else {
      testApiResult.textContent = "❌ API 連線測試失敗";
      testApiResult.style.color = "#f44336";
    }
  } else {
    testApiResult.textContent = "請先測試 API 連線";
    testApiResult.style.color = "#ff9800";
  }
}

// 更新保存按鈕狀態
function updateSaveButtonState() {
  const saveButton = document.getElementById("saveSettings");
  const apiUrl = document.getElementById("apiUrl").value.trim();
  const apiKey = document.getElementById("apiKey").value.trim();

  // 如果有 API 設定但沒有測試成功，禁用保存按鈕
  if (apiUrl && apiKey && (!apiTestStatus.tested || !apiTestStatus.success)) {
    saveButton.disabled = true;
    saveButton.textContent = "💾 儲存設定（請先測試 API）";
    saveButton.style.opacity = "0.6";
  } else {
    saveButton.disabled = false;
    saveButton.textContent = "💾 儲存設定";
    saveButton.style.opacity = "1";
  }
}

// 頁面載入時執行
document.addEventListener("DOMContentLoaded", function () {
  loadSettings();
  loadStatus();

  // 監聽 API 設定變更
  document.getElementById("apiUrl").addEventListener("input", () => {
    resetApiTestStatus();
    updateSaveButtonState();
  });
  document.getElementById("apiKey").addEventListener("input", () => {
    resetApiTestStatus();
    updateSaveButtonState();
  });

  // 每3秒更新一次狀態
  setInterval(loadStatus, 3000);
});
