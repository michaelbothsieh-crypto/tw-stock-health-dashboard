# 台股診斷 PRO (TW Stock Health Dashboard)

這是一個結合 AI 輔助與量化數據的台股/美股雙引擎決策工具。它幫你整合了技術面、籌碼對抗、基本面、海外連動與崩盤預警等關鍵數據，並透過 Web 介面與 Telegram Bot 提供即時的 AI 戰術沙盤推演。

## 專案核心理念
*   **決策輔助**：工具是用來協助判斷，而非取代你的獨立思考或自動交易。
*   **數據透明**：提供可解釋的分數與訊號來源，每一項 AI 決策都能在 UI 上找到底層數據支撐。
*   **高可用性 (3-Tier AI Fallback)**：內建三層降級機制，確保在各種 API 速率限制下，依然能產出作戰建議。

---

## 🔥 核心亮點功能

### 1. 🤖 AI 戰術實戰腳本 (Tactical Playbook)
*   **IF-THEN 邏輯分析**：AI 不僅給出方向，還會擬定具體的戰術腳本（例如：「若能放量站穩壓力位...則有望開啟新一輪攻勢」），幫助投資人預演多種市場情境。
*   **數據支撐透明化**：顯示 AI 決策的底層數據，包含總經狀態、籌碼強度、支撐與壓力精確位階。
*   **3-Tier 備援機制**：
    1.  **Tier 1 (極速解析)**：優先使用 `Groq` (Llama 3.3 70B / Llama 3.1 8B)。
    2.  **Tier 2 (穩定備援)**：若 Groq 達速率限制，無縫切換至 `Gemini 1.5 Flash`。
    3.  **Tier 3 (靜態規則)**：若 AI 皆無回應，自動降級為基於量化公式的「Rule-based 靜態劇本」。

### 2. 📊 全方位數據判讀系統 (Data Interpretation)
*   **分析詳解三階段**：
    - **階段 1：方向判定**（技術 40% + 籌碼 30% + 催化劑 30%）。
    - **階段 2：可出手度**（結合短期機率與一致性，計算回檔風險）。
    - **階段 3：策略類型**（綜合多空條件與風險檢核後的行動建議）。
*   **多維度指標概覽**：透過雷達圖與條狀圖，直觀呈現技術、籌碼、基本、波動、機率、同向六大維度的強弱程度。

### 3. ⚔️ 籌碼對抗雷達 & 內部人動向
*   **籌碼對抗雷達 (5D)**：追蹤三大法人、投信、融資、融券的 5 日變動。AI 會自動給出結論（如：「散戶接刀」、「籌碼凌亂」或「法人鎖碼」）。
*   **法人連動率**：計算外資、投信、自營商的 60 日連動係數，找出真正影響股價的核心推手。
*   **內部人防空警報**：直連 TWSE OpenAPI，監控大筆申報轉讓，AI 自動判讀潛在拋售風險。

### 4. 📈 技術戰術面板 (Technical Tactics)
*   **關鍵位階監控**：即時顯示月線、季線、布林通道上緣等重要技術位階。
*   **量化指標分析**：彙整均線架構（多頭/空頭）、RSI 指標（超買/超賣）、MACD 趨勢（多頭延續/轉弱），並給出具體的技術操作策略。

### 5. 🔗 同業對標與海外連動
*   **族群基準對比**：顯示個股與所屬產業族群指數的相對表現。
*   **連動性排行**：列出本地同業（如日月光、京元電子等）與海外板塊的關聯度百分比，協助判斷類股輪動趨勢。

### 6. 📱 AI 健康戰情室 (Watchlist Command Center)
*   **全局自選股監控**：以卡片形式呈現所有自選標的之綜合健康評分。
*   **視覺化狀態提示**：透過顏色與圖示一眼辨識標的狀態：☀️ 體質強健、☁️ 中性震盪、⛈️ 避險警報。
*   **跨平台同步**：純前端 LocalStorage 架構，自選清單即時更新且不儲存於伺服器。

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
