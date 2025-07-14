# 拓元搶票助手 (Tixcraft Assistant)

用於拓元售票網站的自動化工具，包含桌面應用程式和瀏覽器擴充功能。

## 功能特色

### 桌面應用程式

- **🎯 自動查詢購票連結**：輸入拓元活動頁面網址，自動找到可購買的票種
- **🔍 關鍵字篩選**：可設定特定票價或座位區域關鍵字進行篩選
- **📅 場次選擇**：支援查詢所有場次或僅查詢第一天場次
- **🚀 自動開啟**：找到符合條件的票種後自動開啟購票頁面
- **⚡ 即時反饋**：顯示查詢進度和結果

### 瀏覽器擴充功能

- **🤖 自動填寫驗證碼**：使用 AI 識別並自動填寫驗證碼
- **🎫 自動選擇票數**：可設定購票數量 (1-4 張)
- **⚙️ 自動提交選項**：可選擇是否自動提交訂單

### AI 驗證碼識別服務

- **🧠 OpenAI GPT-4 支援**：使用 GPT4.1 的模型識別驗證碼
- **🔄 Flask API**：提供 RESTful API 服務

## 技術架構

### 桌面應用程式

- **前端**：PyQt5 圖形介面
- **爬蟲**：requests + BeautifulSoup
- **資料處理**：JSON 解析和處理

### 瀏覽器擴充功能

- **平台**：Chrome Extensions Manifest V3
- **API 通訊**：與外部 AI 服務整合
- **儲存**：Chrome Storage API

### 後端 API

- **框架**：Flask + Flask-CORS
- **AI 服務**：OpenAI GPT-4 Vision
- **圖片處理**：Base64 編碼解碼

## 安裝與使用

### 桌面應用程式

### 環境需求

```powershell
pip install PyQt5 requests beautifulsoup4
```

## 注意事項

### 使用前提醒

- ⚠️ **請確保已登入拓元會員**
- ⚠️ **開始搶票的前 15 分鐘先到 https://tixcraft-ocr.onrender.com 喚醒伺服器，否則辨識驗證碼時會嚴重 delay(因雲端伺服器為免費版有此限制，請見諒)**
- ⚠️ **請遵守拓元網站使用條款**
- ⚠️ **本工具僅供學習研究使用**

### 使用方法

1. 執行主程式：

   ```powershell
   python main.py
   ```

   ```powershell
   .\dist\TixcraftAssistant.exe
   ```

2. 輸入拓元活動網址（格式：`https://tixcraft.com/activity/detail/活動代碼`）
3. 選擇查詢設定：
   - **查詢場次**：所有場次 或 僅第一天
   - **查詢票種**：所有票種 或 指定關鍵字篩選
4. 如選擇指定票種，可新增關鍵字（如：搖滾區、1800、VIP 等）
5. 點擊「開始查詢」，程式將自動：
   - 分析活動頁面
   - 找到可購買的票種
   - 自動開啟符合條件的購票頁面

### 瀏覽器擴充功能

### 安裝步驟

1. 下載擴充功能檔案
2. 開啟 Chrome 擴充功能管理頁面 (`chrome://extensions/`)
3. 開啟「開發者模式」
4. 點擊「載入未封裝項目」
5. 選擇專案資料夾

### 使用方法

1. 前往拓元購票頁面
2. 點擊擴充功能圖標
3. 設定票券數量 (1-4 張)
4. 選擇是否自動提交
5. 儲存設定後，擴充功能會自動：
   - 識別驗證碼
   - 填寫驗證碼
   - 選擇票數
   - (可選) 自動提交訂單

### AI 驗證碼識別服務

### 環境設定

```powershell
pip install flask flask-cors openai python-dotenv
```

### 環境變數

建立 `.env` 檔案：

`OPENAI_API_KEY=your_openai_api_key_here`

### 啟動服務

```powershell
python app.py
```

## API 文件

### 驗證碼識別 API

### POST `/analyze-image`

識別驗證碼圖片中的文字

**請求格式：**

```json
{
  "image": "base64_encoded_image_data"
}
```

**回應格式：**

```json
{
  "text": "abcd",
  "time": 1.23
}
```

### 測試端點

- `GET /` - 健康檢查

### 技術限制

- 桌面應用程式需要網路連線
- 瀏覽器擴充功能需要外部 API 服務

### 支援網站

- 拓元售票網 (tixcraft.com)
- 購票頁面格式：`https://tixcraft.com/ticket/ticket/*`

## 開發說明

### 專案特色

此專案展示了多種技術的整合應用：

1. **桌面應用程式開發**：使用 PyQt5 建立用戶友善的 GUI
2. **網頁爬蟲技術**：使用 requests 和 BeautifulSoup 進行資料擷取
3. **瀏覽器擴充功能**：Manifest V3 規範的現代化擴充功能
4. **AI 整合**：OpenAI GPT-4 .1 用於圖片識別
5. **API 服務開發**：Flask 框架建立 RESTful API

## 授權

本專案僅供學習和研究使用。請遵守相關網站的使用條款和法律法規。
