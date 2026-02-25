# 台股波段健康/多空儀表板 (Taiwan Stock Health Dashboard)

這是一個 AI 輔助的台股波段多空與健康度檢查儀表板。提供可量化的技術面、籌碼面、基本面分數評估，並產生綜合分析報告。

## 🌟 Demo
> 🔗 **[Vercel Demo URL (Coming Soon)]()**

## 📸 功能預覽
- **Dashboard**: 即時計算 5 檔個股的三大面向分數與 AI 解讀。
- **Watchlist**: 追蹤自選股清單（LocalStorage）。
- **Reports**: 每日股市/個股 AI 分析簡報。

## 🏗️ 系統架構
本系統分為四大層級：

```mermaid
graph LR
A[Provider<br/>(FinMind API)] --> B[Signals<br/>(Trend/Flow/Fund)]
B --> C[Explain<br/>(AI Rules/LLM)]
C --> D[Next.js API<br/>(/api/stock)]
D --> E[UI Dashboard<br/>(Next.js Client)]
```

## 📊 計分方法 (Scoring Methodology)

### 📈 1. 趨勢分數 (Trend Score) - 0~100 分
判斷技術面強弱：
- **40% 趨勢排列**: 依據 20MA, 60MA, 120MA 多空排列判斷。
- **20% RSI 動能**: RSI(14) 區間動能，>50 強勢，>70 留意超買風險。
- **20% MACD 柱狀**: 趨勢加速指標，紅柱加分。
- **20% 波段報酬**: 近 60 日累積報酬表現。

### 💰 2. 籌碼分數 (Flow Score) - 0~100 分
判斷大戶與散戶動向：
- **外資買賣 (+/-25)**: 統計近 5 日與 20 日外資淨買賣超。
- **投信買賣 (+/-25)**: 統計近 5 日與 20 日投信淨買賣超。
- **融資餘額 (+/-10)**: 檢視散戶籌碼，20 日增幅若過大予以扣分並提示風險。

### 🏭 3. 基本面分數 (Fundamental Score) - 0~100 分
判斷財報實質支撐：
- **YoY 平均**: 最近 3 個月的月營收 YoY 成長率。
- **YoY 趨勢**: YoY 是否保持連續數個月上升。

---

## 🚀 本地開發與啟動 (Getting Started)

### 1. 取得 API Key
- 需要前往 [FinMind 官網](https://finmindtrade.com/) 註冊並取得免費的 **API Token**。

### 2. 環境變數設定
複製專案中的環境變數範本並填入 Token：
```bash
cp .env.example .env
```
編輯 `.env`：
```env
FINMIND_API_TOKEN=您的_FinMind_Token
```

### 3. 安裝與執行
```bash
npm install
npm run dev
```
啟動後請前往 [http://localhost:3000](http://localhost:3000) 檢視 Dashboard。

---

## ⚠️ 免責聲明 (Disclaimer)
> **非投資建議 (Not Financial Advice)**
> 本專案為展示用途 (Demo Project)。所有分數、訊號與 AI 分析均基於歷史統計及規則產生，**不代表未來的實際走勢**。專案結果**不可**作為買賣判斷之唯一依據。投資有賺有賠，交易前請自行審慎評估風險。
