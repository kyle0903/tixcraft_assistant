// === 拓元搶票助手 - 彈出視窗腳本 ===

// 全域變數
let serverWakeTime = null;
let isServerAwake = false;

// 載入已儲存的設定
function loadSettings() {
  chrome.storage.sync.get(
    [
      "autoRedirect",
      "autoGrab",
      "autoSelectTicket",
      "keywords",
      "ticketCount",
      "autoSubmit",
    ],
    function (result) {
      // 自動跳轉設定 (預設為 false)
      document.getElementById("autoRedirect").checked =
        result.autoRedirect || false;

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
            statusDiv.textContent = "請選擇一個拓元網站的活動並使用此擴充功能";
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

// 檢查伺服器狀態
async function checkServerStatus() {
  const statusDiv = document.getElementById("serverStatus");
  statusDiv.textContent = "檢查中...";

  try {
    const response = await fetch("https://tixcraft-assistant.onrender.com", {
      method: "GET",
      timeout: 10000,
    });

    if (response.ok) {
      const data = await response.json();
      if (data.message === "Hello, World!") {
        isServerAwake = true;
        statusDiv.textContent = "✅ 伺服器已喚醒";
        statusDiv.style.color = "#4CAF50";
        return true;
      }
    }

    isServerAwake = false;
    statusDiv.textContent = "❌ 伺服器未回應";
    statusDiv.style.color = "#f44336";
    return false;
  } catch (error) {
    console.error("檢查伺服器狀態失敗:", error);
    isServerAwake = false;
    statusDiv.textContent = "❌ 連線失敗";
    statusDiv.style.color = "#f44336";
    return false;
  }
}

// 喚醒伺服器
async function wakeUpServer() {
  const wakeButton = document.getElementById("wakeServer");
  const statusDiv = document.getElementById("serverStatus");

  // 設定按鈕為載入狀態
  wakeButton.disabled = true;
  wakeButton.textContent = "⏳ 喚醒中...";
  statusDiv.textContent = "正在喚醒伺服器，請稍候...";
  statusDiv.style.color = "#2196F3";

  try {
    const response = await fetch("https://tixcraft-assistant.onrender.com", {
      method: "GET",
    });

    if (response.ok) {
      const data = await response.json();
      if (data.message === "Hello, World!") {
        isServerAwake = true;
        serverWakeTime = Date.now();

        // 儲存喚醒時間到 storage
        chrome.storage.local.set({
          serverWakeTime: serverWakeTime,
          isServerAwake: true,
        });

        statusDiv.textContent = "✅ 伺服器已成功喚醒！";
        statusDiv.style.color = "#4CAF50";

        // 顯示成功訊息
        const status = document.getElementById("status");
        status.textContent =
          "🎉 OCR 伺服器已喚醒，現在可以正常使用驗證碼識別功能！";
      }
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    console.error("喚醒伺服器失敗:", error);
    isServerAwake = false;
    statusDiv.textContent = "❌ 喚醒失敗，請稍後重試";
    statusDiv.style.color = "#f44336";

    const status = document.getElementById("status");
    status.textContent = "❌ 無法連接到 OCR 伺服器，請檢查網路連線";
    setTimeout(() => {
      status.textContent = "";
    }, 3000);
  } finally {
    // 恢復按鈕狀態
    wakeButton.disabled = false;
    wakeButton.textContent = "🚀 喚醒 OCR 伺服器";
  }
}

// 檢查伺服器是否需要喚醒警告
function checkServerWarning() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["serverWakeTime", "isServerAwake"], (result) => {
      const lastWakeTime = result.serverWakeTime;
      const wasAwake = result.isServerAwake;

      // 如果從未喚醒過，或者距離上次喚醒超過 30 分鐘
      const thirtyMinutes = 30 * 60 * 1000;
      const needsWakeup =
        !lastWakeTime || !wasAwake || Date.now() - lastWakeTime > thirtyMinutes;

      if (needsWakeup) {
        const shouldContinue = confirm(
          "⚠️ 注意：OCR 伺服器可能尚未喚醒！\n\n" +
            "建議先點擊「喚醒 OCR 伺服器」按鈕，\n" +
            "否則驗證碼識別功能可能會有延遲或失敗。\n\n" +
            "是否仍要繼續儲存設定？\n\n" +
            "點擊「確定」繼續儲存\n" +
            "點擊「取消」返回喚醒伺服器"
        );
        resolve(shouldContinue);
      } else {
        resolve(true);
      }
    });
  });
}

// 儲存設定
document
  .getElementById("saveSettings")
  .addEventListener("click", async function () {
    // 先檢查伺服器警告
    const shouldContinue = await checkServerWarning();

    if (!shouldContinue) {
      // 使用者選擇不繼續，返回不儲存
      return;
    }

    const keywordsText = document.getElementById("keywords").value.trim();
    const keywords = keywordsText
      ? keywordsText
          .split(",")
          .map((k) => k.trim())
          .filter((k) => k)
      : [];

    const settings = {
      autoRedirect: document.getElementById("autoRedirect").checked,
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
    autoRedirect: false,
    autoGrab: false,
    autoSelectTicket: false,
    autoSubmit: false,
  };

  chrome.storage.sync.set(settings, function () {
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

// 喚醒伺服器按鈕事件
document.getElementById("wakeServer").addEventListener("click", wakeUpServer);

// 頁面載入時執行
document.addEventListener("DOMContentLoaded", function () {
  loadSettings();
  loadStatus();

  // 初始檢查伺服器狀態
  setTimeout(checkServerStatus, 500);

  // 載入伺服器狀態記錄
  chrome.storage.local.get(["serverWakeTime", "isServerAwake"], (result) => {
    if (result.serverWakeTime && result.isServerAwake) {
      serverWakeTime = result.serverWakeTime;
      isServerAwake = result.isServerAwake;

      // 檢查是否超過15分鐘
      const fifteenMinutes = 15 * 60 * 1000;
      if (Date.now() - serverWakeTime > fifteenMinutes) {
        isServerAwake = false;
        chrome.storage.local.set({ isServerAwake: false });
      }
    }
  });

  // 每3秒更新一次狀態
  setInterval(loadStatus, 3000);

  // 每分鐘檢查一次伺服器狀態
  setInterval(checkServerStatus, 60000);
});
