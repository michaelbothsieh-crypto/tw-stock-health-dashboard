# 台股診斷 PRO (TW Stock Health Dashboard)

這是一個結合 AI 輔助與量化數據的台股/美股雙引擎決策工具。它幫你整合了技術面、籌碼對抗、基本面、海外連動與崩盤預警等關鍵數據，並透過 Web 介面與 Telegram Bot 提供即時的 AI 戰術沙盤推演。

## 專案核心理念
*   **決策輔助**：工具是用來協助判斷，而非取代你的獨立思考或自動交易。
*   **數據透明**：提供可解釋的分數與訊號來源，每一項 AI 決策都能在 UI 上找到底層數據支撐。
*   **高可用性 (3-Tier AI Fallback)**：內建三層降級機制，確保在各種 API 速率限制下，依然能產出作戰建議。

---

## 🔥 核心亮點功能

### 1. 🤖 AI 戰術沙盤 (Tactical Playbook)
*   將技術、籌碼、宏觀等碎裂數據，由 20 年經驗的「華爾街老手 AI」收斂為直觀的「操作順序 (SOP)」與「重要觀察對象」。
*   **3-Tier 備援機制**：
    1.  **Tier 1 (極速解析)**：優先使用 `Groq` (Llama 3.3 70B / Llama 3.1 8B)。
    2.  **Tier 2 (穩定備援)**：若 Groq 達速率限制，無縫切換至 `Gemini 1.5 Flash`。
    3.  **Tier 3 (靜態規則)**：若 AI 皆無回應，自動降級為基於量化公式的「Rule-based 靜態劇本」，確保系統永不當機。

### 2. 🛡️ 內部人防空警報 & 籌碼對抗雷達
*   **內部人動向監控**：直連 TWSE OpenAPI，自動過濾近 60 日、大於 1,000 萬的董監事申報轉讓。AI 會自動判讀是「市場拋售 (紅色警戒)」還是「持股調整 (中性)」。
*   **籌碼對抗雷達**：將三大法人與散戶融資動態進行 2x2 視覺化對比，AI 能精準識別「散戶接刀」或「投信作帳」並給出嚴厲警告。

### 3. 📱 AI 健康戰情室 (Watchlist Command Center)
*   純前端 LocalStorage 架構，跨頁面狀態 100% 完美同步。
*   鳥瞰所有自選股的「AI 天氣預報」：☀️ 體質強健、☁️ 中性震盪、⛈️ 避險警報。
*   搭配 Ambient Glow (環境光暈) UI 設計與獨立的 AI 15 字短評，一眼看穿個股多空。

### 4. 🌍 宏觀資金雷達
*   主控台頂部常駐 `VIX (恐慌指數)`、`DXY (美元流動性)`、`SOXX (費半趨勢)` 數據膠囊，支援互動式科普 Tooltip。

### 5. ✈️ VIP 專屬 Telegram 智能推播
*   內建 Cron Job 端點，定時掃描 `WATCHLIST_TW` 標的。
*   當偵測到「大股東大筆拋售」或「籌碼面極度凌亂」時，AI 分析師會自動撰寫毒舌且具急迫感的警報文案，並推播至 Telegram。

---

## 🛠️ 技術架構
*   **Frontend**: Next.js 15 (App Router) / React 19 / Tailwind CSS v4 / Recharts
*   **AI Models**: Groq (Llama 3), Google Gemini
*   **Data Providers**: FinMind (台股), Yahoo Finance (美股/宏觀), TWSE OpenAPI (內部人)
*   **Caching & State**: Upstash Redis (全局快取), LocalStorage (自選股狀態)

---

## ⚙️ 環境變數設定 (.env.local)

請在專案根目錄建立 `.env.local`，並填入以下金鑰才能完全啟動 PRO 版功能：

```env
# 1. 核心資料源 (FinMind 為必填，否則台股無籌碼與財報數據)
FINMIND_API_TOKEN="your_finmind_token"

# 2. AI 戰術大腦金鑰 (Groq 為主，Gemini 為輔)
GROQ_API_KEY="gsk_..."
GEMINI_API_KEY="AIzaSy..."

# 3. 系統全局快取 (加速回應並節省 API Quota)
UPSTASH_REDIS_REST_URL="https://your-upstash-url.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your_upstash_token"

# 4. Telegram 智能推播 (選填，若需要防空警報推播則需設定)
TELEGRAM_BOT_TOKEN="your_bot_token"
TELEGRAM_CHAT_ID="your_chat_id"

# 5. 專屬掃描清單 (Cron Job 監聽對象，以逗號分隔)
WATCHLIST_TW="2330,2317,2344,2615"
```

---

## 🚀 啟動與開發指令

```bash
# 安裝依賴
npm install

# 啟動本地開發伺服器
npm run dev

# 專案建置
npm run build

# 執行 TypeScript 靜態型別檢查
npm run lint
```

## 免責聲明
本專案所有內容、AI 生成之文字、及量化數據僅供個人研究與決策輔助參考，絕對不構成任何形式的投資操作建議。入市有風險，投資需謹慎。
