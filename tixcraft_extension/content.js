// === 拓元搶票助手 - 內容腳本 ===
console.log("拓元搶票助手已載入", location.href);

// 全域變數
let isRunning = false;
let settings = {};

// 將圖片 URL 轉換為 base64
async function urlToBase64(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("轉換 base64 時發生錯誤:", error);
    return null;
  }
}

async function getCode(imageUrl) {
  try {
    // 將圖片轉換為 base64
    const base64Image = await urlToBase64(imageUrl);
    if (!base64Image) {
      throw new Error("無法轉換圖片為 base64");
    }

    // 從 ConfigManager 取得 API 設定
    const config = await ConfigManager.getConfig();

    if (!config.apiUrl) {
      throw new Error("請先在擴充功能設定中輸入 API 伺服器網址");
    }

    // 建構完整的 API URL
    const apiUrl = config.apiUrl.endsWith("/")
      ? config.apiUrl + "analyze-image"
      : config.apiUrl + "/analyze-image";

    const headers = {
      "Content-Type": "application/json",
    };

    // 如果有 API Key，加入 header
    if (config.apiKey) {
      headers["X-API-Key"] = config.apiKey;
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: headers,
      body: JSON.stringify({
        image: base64Image,
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("API Key 無效，請檢查擴充功能設定");
      }
      console.log(response);
      throw new Error("後端服務錯誤");
    }

    const data = await response.json();
    return data.text;
  } catch (error) {
    console.error("Error:", error);
    return null;
  }
}

// 判斷是否為重新整理
function isPageRefresh() {
  const navigation = window.performance.getEntriesByType("navigation")[0];
  return navigation.type === "reload";
}

// 監聽頁面變化
async function checkAndFillVerifyCode() {
  try {
    // 使用更精確的選擇器
    const verifyCodeInput = document.getElementById("TicketForm_verifyCode");

    // 尋找所有 select 元素
    const selects = document.querySelectorAll("select");

    const agreeInput = document.querySelector('input[type="checkbox"]');

    const submitButton = document.querySelector('button[type="submit"]');

    const captchaImage = document.getElementById("TicketForm_verifyCode-image");

    const captchaImageUrl = captchaImage.src;

    for (const select of selects) {
      // 檢查這個 select 是否有 1,2,3,4 的選項
      const hasValidOptions = Array.from(select.options).some((option) =>
        ["1", "2", "3", "4"].includes(option.value)
      );

      if (hasValidOptions) {
        console.log("找到票券選擇器:", select.id);

        // 從 storage 讀取票券數量
        chrome.storage.sync.get(["ticketCount"], function (result) {
          if (result.ticketCount) {
            select.value = result.ticketCount;
          } else {
            select.value = "1";
          }
        });
        break; // 找到第一個就跳出
      }
    }

    if (agreeInput) {
      agreeInput.checked = true;
    }

    // 如果驗證碼輸入框存在且沒有值，才獲取新的驗證碼
    if (verifyCodeInput && !verifyCodeInput.value) {
      const code = await getCode(captchaImageUrl);
      if (code) {
        verifyCodeInput.value = code;
      }
    }

    if (submitButton) {
      chrome.storage.sync.get(["autoSubmit"], function (result) {
        if (result.autoSubmit && verifyCodeInput.value && agreeInput.checked) {
          submitButton.click();
        }
      });
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

// === 頁面類型檢測和主要邏輯 ===
function detectPageType() {
  const url = location.href;

  if (url.includes("/activity/detail/")) {
    return "activity_detail";
  } else if (url.includes("/activity/game/")) {
    return "activity_game";
  } else if (url.includes("/ticket/area/")) {
    return "ticket_area";
  } else if (url.includes("/ticket/ticket/")) {
    return "ticket_purchase";
  }

  return "unknown";
}

// === 活動詳情頁面處理 ===
class ActivityDetailHandler {
  constructor() {
    this.console = console;
  }

  // 尋找購買按鈕
  findBuyButton() {
    // 尋找具有特定 class 的按鈕
    const buyButton = document.querySelectorAll(
      ".btn.btn-primary.text-bold.m-0"
    );
    let buyButtonUrl = null;
    for (const button of buyButton) {
      if (button.disabled) {
        continue;
      }
      buyButtonUrl = button.dataset.href;
    }
    return buyButtonUrl;
  }

  // 檢查是否開賣
  async checkAndClickBuy() {
    if (!settings.autoGrab) return;

    const buyButton = this.findBuyButton();
    if (buyButton) {
      this.showNotification("找到購買按鈕，正在進入購票頁面...");
      window.location.href = buyButton;
      return true;
    }
    return false;
  }

  // 檢查是否顯示倒數計時
  checkCountdownTimer() {
    const countdownTimer = document.querySelectorAll(".gridc.fcTxt");
    if (countdownTimer[0].innerHTML.includes("text-center")) {
      this.console.log(countdownTimer[0].innerText.split("\n")[1].trim());
      return true;
    }
    return false;
  }

  // 簡單的搶票邏輯：檢查並點擊或刷新
  async monitorBuyButton() {
    if (!settings.autoGrab) return;

    this.console.log("🔄 檢查購買按鈕狀態...");

    // 先檢查是否有購買按鈕
    const buyButtonFound = await this.checkAndClickBuy();
    if (buyButtonFound) {
      this.console.log("✅ 找到購買按鈕，已點擊！");
      return;
    }

    // 如果沒有購買按鈕，檢查是否有倒數計時
    const hasCountdown = this.checkCountdownTimer();

    if (hasCountdown) {
      this.showNotification("檢測到倒數計時，刷新頁面中...");

      // 1秒後刷新頁面
      setTimeout(() => {
        location.reload();
      }, 1000);
    } else {
      this.showNotification("未檢測到倒數計時，手動刷新或檢查頁面狀態");
    }
  }

  showNotification(message) {
    // 在頁面上顯示通知
    const notification = document.createElement("div");
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 15px;
      border-radius: 5px;
      z-index: 9999;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }
}

// === 場次選擇頁面處理 ===
class TicketAreaHandler {
  constructor() {
    this.console = console;
  }

  // 根據關鍵字尋找票種
  findTicketsByKeyword() {
    const tickets = [];
    const ticketElements = document.querySelectorAll("li a[id]");

    ticketElements.forEach((element) => {
      const text = element.textContent.toLowerCase();
      const excludeKeywords = [
        "wheelchair",
        "身障",
        "愛心",
        "陪同",
        "登出",
        "logout",
      ];

      // 排除特殊票種
      if (excludeKeywords.some((keyword) => text.includes(keyword))) {
        return;
      }

      // 檢查是否符合關鍵字
      let matches = true;
      if (settings.keywords && settings.keywords.length > 0) {
        matches = settings.keywords.some((keyword) =>
          text.includes(keyword.toLowerCase())
        );
      }

      if (matches) {
        tickets.push({
          element: element,
          text: element.textContent.trim(),
          id: element.id,
        });
      }
    });

    return tickets;
  }

  // 自動選擇票種
  async autoSelectTicket() {
    if (!settings.autoSelectTicket) return;

    const tickets = this.findTicketsByKeyword();

    if (tickets.length > 0) {
      const selectedTicket = tickets[0]; // 選擇第一個符合的票種
      this.console.log("🎫 自動選擇票種:" + "\n" + selectedTicket.text);

      // 點擊票種
      selectedTicket.element.click();
      return true;
    } else {
      // 如果找不到關鍵字，選擇第一個可用票種
      if (settings.keywords && settings.keywords.length > 0) {
        this.showNotification(
          "🎫 找不到符合條件的票種，正在選擇第一個可用票種..."
        );
        const allTickets = document.querySelectorAll("li a[id]");
        if (allTickets.length > 0) {
          this.console.log(
            "🎫 選擇第一個可用票種：" + allTickets[0].textContent
          );
          allTickets[0].click();
          return true;
        }
      }
    }

    this.showNotification("❌ 很可惜，已經沒有票了，可以再重新整理試試看😭");
    return false;
  }

  showNotification(message) {
    // 在頁面上顯示通知
    const notification = document.createElement("div");
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 15px;
      border-radius: 5px;
      z-index: 9999;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }
}

// === 購票頁面處理（原有的驗證碼功能）===
class TicketPurchaseHandler {
  async handle() {
    await checkAndFillVerifyCode();
  }
}

// === 主要執行邏輯 ===
async function main() {
  // 載入設定
  await loadSettings();

  const pageType = detectPageType();
  console.log("📍 目前頁面類型:", pageType);

  // 檢查是否需要自動功能
  const needsAutoFeatures = [
    "activity_game",
    "ticket_area",
    "ticket_purchase",
  ].includes(pageType);

  if (needsAutoFeatures) {
    // 檢查 API 是否已測試成功
    const isApiReady = await ConfigManager.isApiReady();

    if (!isApiReady) {
      console.warn("⚠️ API 尚未測試成功，自動功能已停用");
      showApiWarning(pageType);
      return;
    }
  }

  switch (pageType) {
    case "activity_game":
      const activityHandler = new ActivityDetailHandler();
      await activityHandler.monitorBuyButton();
      break;

    case "ticket_area":
      const areaHandler = new TicketAreaHandler();
      await areaHandler.autoSelectTicket();
      break;

    case "ticket_purchase":
      const purchaseHandler = new TicketPurchaseHandler();
      await purchaseHandler.handle();
      break;

    default:
      console.log("🔍 未知頁面類型，等待用戶操作");
  }
}

// 顯示 API 警告
function showApiWarning(pageType) {
  const pageNames = {
    activity_game: "自動搶票",
    ticket_area: "自動選票",
    ticket_purchase: "自動填寫驗證碼",
  };

  const featureName = pageNames[pageType] || "自動功能";

  const warning = document.createElement("div");
  warning.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #ff6b6b;
    color: white;
    padding: 20px;
    border-radius: 8px;
    z-index: 9999;
    box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
    max-width: 300px;
    font-size: 14px;
    line-height: 1.5;
  `;

  warning.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 10px;">⚠️ ${featureName}功能已停用</div>
    <div style="margin-bottom: 15px;">請先在擴充功能中測試 API 連線</div>
    <div style="font-size: 12px; opacity: 0.9;">
      1. 點擊瀏覽器右上角的擴充功能圖示<br>
      2. 輸入 API Key<br>
      3. 點擊「🔌 測試 API 連線」按鈕
    </div>
  `;

  document.body.appendChild(warning);

  // 10秒後自動消失
  setTimeout(() => {
    if (warning.parentNode) {
      warning.parentNode.removeChild(warning);
    }
  }, 10000);
}

// 載入設定
async function loadSettings() {
  try {
    settings = await ConfigManager.getConfig();
    console.log("⚙️ 已載入設定:", settings);
  } catch (error) {
    console.error("載入設定失敗:", error);
    // 使用預設設定
    settings = ConfigManager.defaults;
  }
}

// 監聽來自 popup 的訊息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateSettings") {
    settings = request.settings;
    console.log("⚙️ 設定已更新:", settings);
    sendResponse({ success: true });
  } else if (request.action === "getStatus") {
    sendResponse({
      isRunning: isRunning,
      pageType: detectPageType(),
      settings: settings,
    });
  }
});

// 啟動主要邏輯
main();
