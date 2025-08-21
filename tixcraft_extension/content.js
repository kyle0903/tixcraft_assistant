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

// === 頁面處理器 ===
class PageHandler {
  constructor() {
    this.console = console;
  }

  // 統一處理所有頁面類型
  async handlePage(pageType) {
    try {
      this.console.log(`分析${pageType}頁面...`);

      // 獲取頁面內容
      const htmlContent = document.documentElement.outerHTML;
      const url = location.href;

      // 呼叫後端API進行智能分析
      const instruction = await this.getPageInstruction(
        pageType,
        htmlContent,
        url
      );

      if (instruction) {
        await this.executeInstruction(instruction);
      }
    } catch (error) {
      console.error("頁面處理失敗:", error);
      this.showNotification("❌ 分析頁面失敗，請檢查網路連線");
    }
  }

  // 呼叫後端API獲取指令
  async getPageInstruction(pageType, htmlContent, url) {
    const config = await ConfigManager.getConfig();

    if (!config.apiUrl || !config.apiKey) {
      throw new Error("API 設定不完整");
    }

    const apiUrl = config.apiUrl.endsWith("/")
      ? config.apiUrl + "analyze-page"
      : config.apiUrl + "/analyze-page";

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": config.apiKey,
      },
      body: JSON.stringify({
        pageType: pageType,
        htmlContent: htmlContent,
        url: url,
        settings: settings,
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("API Key 無效");
      }
      throw new Error(`後端服務錯誤: ${response.status}`);
    }

    return await response.json();
  }

  // 執行後端返回的指令
  async executeInstruction(instruction) {
    const action = instruction.action;
    const message = instruction.message;

    if (message) {
      this.showNotification(message);
    }

    switch (action) {
      case "redirect":
        if (instruction.url) {
          this.console.log("🔄 執行跳轉:", instruction.url);
          window.location.href = instruction.url;
        }
        break;

      case "refresh":
        const delay = instruction.delay || 1000;
        this.console.log(`🔄 ${delay}ms後刷新頁面`);
        setTimeout(() => {
          location.reload();
        }, delay);
        break;

      case "click":
        if (instruction.selector) {
          this.console.log("🖱️ 執行點擊:", instruction.selector);
          const element = this.safeQuerySelector(instruction.selector);
          if (element) {
            element.click();
          } else {
            this.showNotification("❌ 找不到指定元素");
          }
        }
        break;

      case "execute":
        if (instruction.actions) {
          this.console.log("🔧 執行多個動作:", instruction.actions.length);
          for (const subAction of instruction.actions) {
            await this.executeAction(subAction);
          }
        }
        break;

      case "wait":
        this.console.log("⏳ 等待中:", message);
        break;

      default:
        this.console.log("❓ 未知指令:", action);
    }
  }

  // 安全的 querySelector，處理以數字開頭的 ID
  safeQuerySelector(selector) {
    try {
      // 如果是以 # 開頭的 ID 選擇器且以數字開頭，使用屬性選擇器
      if (selector.startsWith("#") && /^#\d/.test(selector)) {
        const id = selector.slice(1); // 移除 #
        return document.querySelector(`[id="${id}"]`);
      }

      // 其他情況使用正常的 querySelector
      return document.querySelector(selector);
    } catch (error) {
      console.error("無效的選擇器:", selector, error);
      return null;
    }
  }

  // 執行單個動作
  async executeAction(action) {
    switch (action.action) {
      case "setValue":
        const selectElement = this.safeQuerySelector(action.selector);
        if (selectElement) {
          selectElement.value = action.value;
          this.console.log(`✅ 設定值 ${action.selector} = ${action.value}`);
        }
        break;

      case "check":
        const checkboxElement = this.safeQuerySelector(action.selector);
        if (checkboxElement) {
          checkboxElement.checked = true;
          this.console.log(`✅ 勾選 ${action.selector}`);
        }
        break;

      case "fillCaptcha":
        await this.fillCaptcha(action.imageUrl, action.inputSelector);
        break;

      case "conditionalSubmit":
        await this.conditionalSubmit(action.selector, action.conditions);
        break;
    }
  }

  // 填寫驗證碼
  async fillCaptcha(imageUrl, inputSelector) {
    try {
      this.console.log("🔍 分析驗證碼...");
      const code = await getCode(imageUrl);
      if (code) {
        const input = this.safeQuerySelector(inputSelector);
        if (input) {
          input.value = code;
          this.console.log("✅ 驗證碼已填入:", code);
        }
      }
    } catch (error) {
      console.error("驗證碼分析失敗:", error);
    }
  }

  // 條件性提交
  async conditionalSubmit(selector, conditions) {
    let canSubmit = true;

    for (const condition of conditions) {
      switch (condition) {
        case "captchaFilled":
          const captchaInput = this.safeQuerySelector("#TicketForm_verifyCode");
          if (!captchaInput || !captchaInput.value.trim()) {
            canSubmit = false;
            this.console.log("❌ 驗證碼未填寫");
          }
          break;

        case "agreementChecked":
          const agreementCheckbox = this.safeQuerySelector(
            'input[type="checkbox"]'
          );
          if (!agreementCheckbox || !agreementCheckbox.checked) {
            canSubmit = false;
            this.console.log("❌ 同意條款未勾選");
          }
          break;
      }
    }

    if (canSubmit) {
      const submitButton = this.safeQuerySelector(selector);
      if (submitButton) {
        this.console.log("🚀 執行提交");
        submitButton.click();
      }
    } else {
      this.console.log("⏳ 提交條件不滿足，等待中...");
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
    }, 2000);
  }
}

// === 購票頁面處理 ===
class TicketPurchaseHandler {
  async handle() {
    // 保留驗證碼功能
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

    // 統一處理所有頁面
    const pageHandler = new PageHandler();
    await pageHandler.handlePage(pageType);
  } else {
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
