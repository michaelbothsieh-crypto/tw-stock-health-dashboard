# 台股診斷 PRO (TW Stock Health Dashboard)

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/michaelbothsieh-crypto/tw-stock-health-dashboard)
[![Stack](https://img.shields.io/badge/Stack-Next.js%2015%20%7C%20AI%20%7C%20Redis-blue)](https://nextjs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

這是一個專為專業投資人設計的 **AI 量化決策輔助系統**。它透過高度解耦的微服務架構，整合了技術指標、籌碼對抗、基本面數據與海外連動，並結合頂尖 AI 模型產出具備實戰價值的戰術腳本。

---

## 🌟 核心功能矩陣

### 1. 🤖 AI 戰術大腦 (Tactical Intelligence)
*   **實戰腳本生成**：結合技術位階與籌碼流向，由 AI 產出「IF-THEN」邏輯的實戰演練建議。
*   **多維度健康評分**：綜合技術 (40%)、籌碼 (30%) 與催化劑 (30%)，產出具備可解釋性的綜合健康指標。
*   **回檔風險預警**：利用短期波動率與機率模型，量化目前的出手勝率與潛在回檔風險。

### 2. ⚡ Telegram 智能助理 (Next-Gen Bot)
系統提供功能強大的 Telegram Bot 入口，支援以下專業指令：
*   🔍 `/stock [代號]`：**台美股通用查詢**。自動偵測市場並回傳深度個股卡片、即時報價與 AI 分析。
*   🔥 `/hot [stock/etf]`：**Yahoo 社群爆紅榜**。即時掌握市場最受關注的熱門標的。
*   📊 `/etf [代號]`：**成分股穿透分析**。解析 ETF 持股權重、YTD 績效與淨值變動。
*   🏆 `/twrank` / `/usrank`：**強勢股掃描**。過濾水餃股後，精選昨日漲幅最強勁的 10 檔標的。
*   📈 `/roi [代號] [期間]`：**自定義回測**。精準計算特定時間段（如 1y, YTD）的投資報酬率。
*   🤔 `/whatis [名稱/代號]`：**AI 公司百科**。快速獲取公司背景、核心業務與近期關鍵新聞摘要。

### 3. ⚔️ 籌碼與技術深度判讀
*   **TradingView 技術溫度計**：整合 TradingView 權威評分，直觀顯示「強力買入」至「強力賣出」的技術狀態。
*   **籌碼對抗雷達 (5D)**：追蹤三大法人與融資券的 5 日對抗態勢，輔以內部人申報轉讓監控。
*   **海外連動分析**：計算個股與海外板塊（如 SOXX, QQQ）的連動係數，掌握類股輪動先機。

---

## 🏗️ 軟體工程實踐
本專案經歷了深度的架構重構，嚴格遵循以下現代軟體開發標準：
*   **SOLID & SoC**：核心邏輯已解耦為 `SnapshotService`、`StockService` 與 `MessageService`，確保職責單一且易於測試。
*   **Strategy Pattern**：Telegram 指令分發採用策略模式，具備極高的擴充性。
*   **SSOT (Single Source of Truth)**：統一的數據抓取與格式化接口，確保 Web 介面、API 與報表腳本數據 100% 同步。
*   **RAII & DRY**：嚴謹的資源管理與代碼複用，杜絕重複的 API 呼叫邏輯。

---

## ⚙️ 快速上手

### 環境變數配置 (.env.local)
請參考 `.env.example` 建立配置，核心金鑰包含：
*   `GROQ_API_KEY`：AI 邏輯分析核心。
*   `UPSTASH_REDIS_REST_URL`：全局數據快取，確保極速回應。
*   `TELEGRAM_BOT_TOKEN`：啟動智能助理服務。

### 開發指令
```bash
# 環境安裝
npm install

# 啟動開發伺服器
npm run dev

# 專案建置與型別檢查
npm run build
```

---

## 📅 自動化工具
*   **每日盤後報告**：透過 `scripts/generateDailyReport.ts` 自動產生 Markdown 格式的盤後概覽，並同步推送至 Telegram。
*   **崩盤預警監測**：後端 Cron Job 定期執行總經壓力測試，守護投資安全。

---

## 免責聲明
本系統之所有內容、AI 生成建議及量化數據僅供學術研究與決策輔助參考，不構成任何形式的投資操作建議。金融市場具備高度風險，投資前請務必進行獨立評估。
