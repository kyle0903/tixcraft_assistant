// tixcraft_extension/config.js
class ConfigManager {
  // 預設設定
  static defaults = {
    // API 設定
    apiUrl: "https://tixcraft-api-820504025283.asia-east1.run.app",
    apiKey: "",
    timeout: 30000,
    retryCount: 3,

    // API 測試狀態
    apiTested: false,
    apiTestSuccess: false,
    lastApiTestTime: null,

    // 搶票功能設定
    autoRedirect: false,
    autoGrab: false,
    autoSelectTicket: false,
    keywords: [],
    ticketCount: "1",
    autoSubmit: false,
  };

  // 取得設定
  static async getConfig() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(Object.keys(this.defaults), (result) => {
        // 處理 keywords 格式轉換
        if (result.keywords && typeof result.keywords === "string") {
          result.keywords = result.keywords
            .split(",")
            .map((k) => k.trim())
            .filter((k) => k);
        }

        // 確保 ticketCount 是字串格式
        if (result.ticketCount && typeof result.ticketCount === "number") {
          result.ticketCount = result.ticketCount.toString();
        }

        // 合併預設值和使用者設定
        const config = { ...this.defaults, ...result };
        resolve(config);
      });
    });
  }

  // 儲存設定
  static async saveConfig(newConfig) {
    return new Promise((resolve) => {
      // 處理 keywords 格式 - 如果是陣列，保持陣列格式
      const configToSave = { ...newConfig };

      chrome.storage.sync.set(configToSave, () => {
        console.log("設定已儲存:", configToSave);
        resolve();
      });
    });
  }

  // 取得特定設定
  static async get(key) {
    const config = await this.getConfig();
    return config[key];
  }

  // 更新特定設定
  static async set(key, value) {
    const currentConfig = await this.getConfig();
    const newConfig = { [key]: value };
    await this.saveConfig(newConfig);
    return { ...currentConfig, ...newConfig };
  }

  // 重置為預設值
  static async resetToDefaults() {
    await this.saveConfig(this.defaults);
    return this.defaults;
  }

  // 驗證設定
  static validateConfig(config) {
    const errors = [];

    if (config.apiUrl && !this.isValidUrl(config.apiUrl)) {
      errors.push("API URL 格式不正確");
    }

    if (config.ticketCount) {
      const count = parseInt(config.ticketCount);
      if (isNaN(count) || count < 1 || count > 4) {
        errors.push("票券數量必須介於 1-4 之間");
      }
    }

    if (!config.apiKey) {
      errors.push("API Key 不能為空");
    }

    return errors;
  }

  // 檢查 API 是否已測試成功
  static async isApiReady() {
    const config = await this.getConfig();
    return config.apiTested && config.apiTestSuccess;
  }

  // 設定 API 測試結果
  static async setApiTestResult(success) {
    const now = new Date().toISOString();
    await this.saveConfig({
      apiTested: true,
      apiTestSuccess: success,
      lastApiTestTime: now,
    });
  }

  // 重置 API 測試狀態（當 API 設定改變時）
  static async resetApiTestStatus() {
    await this.saveConfig({
      apiTested: false,
      apiTestSuccess: false,
      lastApiTestTime: null,
    });
  }

  // 檢查 URL 格式
  static isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }
}
