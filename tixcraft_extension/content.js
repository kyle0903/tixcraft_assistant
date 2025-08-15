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

    const response = await fetch(
      "https://tixcraft-assistant.onrender.com/analyze-image",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: base64Image,
        }),
      }
    );

    if (!response.ok) {
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
    console.log("是否為重新整理:", isPageRefresh());
    // 使用更精確的選擇器
    const verifyCodeInput = document.getElementById("TicketForm_verifyCode");

    // 尋找所有 select 元素
    const selects = document.querySelectorAll("select");

    const agreeInput = document.querySelector('input[type="checkbox"]');

    const submitButton = document.querySelector('button[type="submit"]');

    const captchaImage = document.getElementById("TicketForm_verifyCode-image");

    const captchaImageUrl = captchaImage.src;

    console.log(captchaImageUrl);

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
    const buyButtons = document.querySelectorAll("li.buy a");
    return buyButtons.length > 0 ? buyButtons[0] : null;
  }

  // 檢查是否開賣
  async checkAndClickBuy() {
    if (!settings.autoGrab) return;

    const buyButton = this.findBuyButton();
    if (buyButton) {
      this.console.log("✅ 找到購買按鈕，準備點擊");

      // 顯示通知
      this.showNotification("找到購買按鈕，正在進入購票頁面...");

      // 點擊購買按鈕
      buyButton.click();
      return true;
    }

    return false;
  }

  // 持續監控購買按鈕
  async monitorBuyButton() {
    if (!settings.autoGrab || isRunning) return;

    isRunning = true;
    this.console.log("🔄 開始監控購買按鈕...");

    const checkInterval = setInterval(async () => {
      const found = await this.checkAndClickBuy();
      if (found) {
        clearInterval(checkInterval);
        isRunning = false;
      }
    }, 1000); // 每秒檢查一次

    // 30分鐘後停止監控
    setTimeout(() => {
      clearInterval(checkInterval);
      isRunning = false;
      this.console.log("⏰ 監控時間結束");
    }, 30 * 60 * 1000);
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
      const excludeKeywords = ["wheelchair", "身障", "愛心", "陪同"];

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
      this.console.log("🎫 自動選擇票種:", selectedTicket.text);

      // 點擊票種
      selectedTicket.element.click();
      return true;
    } else {
      this.console.log("❌ 找不到符合條件的票種");

      // 如果沒有關鍵字限制，選擇第一個可用票種
      if (!settings.keywords || settings.keywords.length === 0) {
        const allTickets = document.querySelectorAll("li a[id]");
        if (allTickets.length > 0) {
          this.console.log("🎫 選擇第一個可用票種");
          allTickets[0].click();
          return true;
        }
      }
    }

    return false;
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

  switch (pageType) {
    case "activity_detail":
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

// 載入設定
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      ["autoGrab", "autoSelectTicket", "keywords", "ticketCount", "autoSubmit"],
      (result) => {
        settings = {
          autoGrab: result.autoGrab || false,
          autoSelectTicket: result.autoSelectTicket || false,
          keywords: result.keywords || [],
          ticketCount: result.ticketCount || "1",
          autoSubmit: result.autoSubmit || false,
        };
        console.log("⚙️ 已載入設定:", settings);
        resolve();
      }
    );
  });
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
