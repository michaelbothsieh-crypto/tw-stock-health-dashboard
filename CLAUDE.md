# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案簡介

**台股診斷 PRO** — 結合 AI 輔助與量化數據的台股/美股雙引擎決策工具，整合技術面、籌碼對抗、基本面、海外連動與崩盤預警，透過 Web 介面與 Telegram Bot 提供即時 AI 戰術沙盤推演。

## 常用指令

```bash
# 開發
npm run dev              # 啟動本地開發伺服器
npm run build            # 生產環境建置
npm run lint             # ESLint + TypeScript 型別檢查

# 測試
npm run test             # 執行 Vitest 全部單元測試

# 資料驗證腳本
npm run selfcheck:all    # 執行公司名稱、財報、新聞 selfcheck
npm run selfcheck        # 分數計算 selfcheck
npm run selfcheck:fundamental   # 市值 / 本益比驗證
npm run selfcheck:news          # 新聞抓取 selfcheck
npm run selfcheck:strategy      # 策略引擎 selfcheck

# 功能驗證腳本
npm run verify:telegram-bot     # Telegram 推播驗證
npm run verify:crash-v2         # 崩盤預警引擎驗證
npm run verify:profile-linkage  # US 聯動驗證

# 每日報告
npm run report:daily     # 生成每日分析報告
```

**注意**: `selfcheck:*` 和 `verify:*` 腳本需要 `ts-node` (使用 `scripts/tsconfig.selfcheck.json`)；`selfcheck` 和 `report:daily` 使用 `tsx`。

## 架構概覽

### 3-Tier AI 備援機制

系統核心設計，確保在 API 速率限制下永不停機：
1. **Tier 1 (Groq)** — Llama 3.3 70B / Llama 3.1 8B，極速推論
2. **Tier 2 (Gemini)** — Google Gemini 1.5 Flash，穩定備援
3. **Tier 3 (Rule-based)** — 靜態規則引擎，確保系統降級可用

相關檔案：`src/lib/ai/playbookAgent.ts`, `src/lib/ai/modelRouter.ts`

### 資料流

```
User → useStockSnapshot() → /api/stock/[ticker]/snapshot
  ├── FinMind (台股) / Yahoo Finance (美股)
  ├── TradingView (技術指標)
  ├── TWSE OpenAPI (內部人申報)
  └── Upstash Redis (快取層)
    ↓
Signal Calculators (trend / flow / fundamental / volatility)
    ↓
Strategy Engine (規則匹配) → AI Playbook Agent
    ↓
UI Render: Tiles, Charts, Score Explainer
```

### 目錄結構

```
src/
├── app/
│   ├── api/                    # API 路由 (Next.js Route Handlers)
│   │   ├── stock/[ticker]/     # snapshot + insider 端點
│   │   ├── global/crash/       # 崩盤預警
│   │   ├── cron/daily-alert/   # Telegram cron 觸發
│   │   ├── telegram/webhook    # Telegram Bot webhook
│   │   └── report/             # 每日報告端點
│   └── stock/[ticker]/         # 個股詳情頁 (動態路由)
├── components/
│   ├── dashboard/              # Bento 主版面
│   ├── tiles/                  # 資料磚 (Technical, Flow, Macro)
│   ├── charts/                 # Recharts 封裝
│   └── ui/                     # Shadcn/Radix UI 基礎元件
├── lib/
│   ├── ai/                     # AI 模型路由、Playbook、Alert 生成
│   ├── signals/                # 技術與基本面評分計算
│   │   ├── trend.ts            # SMA / RSI / MACD 計算 + 趨勢分數
│   │   ├── flow.ts             # 法人 / 融資流量分析 + 籌碼分數
│   │   ├── fundamental.ts      # 本益比 / 營收成長
│   │   └── shortTerm.ts        # 1D/3D/5D 機率預測
│   ├── strategy/
│   │   └── strategyEngine.ts   # 5 條規則式交易決策引擎
│   ├── global/                 # VIX/DXY/SOXX 宏觀 + 崩盤偵測
│   ├── providers/              # 外部 API 封裝 (FinMind, Yahoo, TradingView, Redis)
│   ├── news/                   # 新聞分類、情緒評分
│   ├── predict/                # ML 機率模型
│   ├── types/stock.ts          # UnifiedStockSnapshot 核心介面
│   └── __tests__/              # 單元測試
├── hooks/                      # useStockSnapshot, useWatchlist
└── data/twStockNames.ts        # 台股靜態名稱資料庫
```

### 策略引擎規則 (`src/lib/strategy/strategyEngine.ts`)

| 規則 | 觸發條件 | 輸出策略 |
|------|----------|----------|
| `rule_breakout_follow` | 突破條件 + 成交量放大 | 短線做多 |
| `rule_pullback_buy` | 強趨勢 + 適度拉回 + 籌碼支撐 | 波段進場 |
| `rule_news_event` | 強催化劑 + 波動放大 | 事件驅動 |
| `rule_flow_risk_off` | 籌碼惡化 + 技術面轉弱 | 等待/減碼 |
| `rule_dead_cat_bounce` | 弱趨勢 + 短期反彈 + 5D 機率低 | 反彈交易 |

### 分數維度 (8 個)

`trendScore`, `flowScore`, `fundamentalScore`, `catalystScore`, `volatilityScore`, `probability1D/3D/5D`, `pullbackRisk`, `consistencyScore`

## 環境變數

```env
FINMIND_API_TOKEN=      # 必填，台股籌碼與財報數據
GROQ_API_KEY=           # AI 主引擎
GEMINI_API_KEY=         # AI 備援
UPSTASH_REDIS_REST_URL= # 快取
UPSTASH_REDIS_REST_TOKEN=
TELEGRAM_BOT_TOKEN=     # 選填，推播功能
TELEGRAM_CHAT_ID=       # 選填，推播目標
WATCHLIST_TW=           # Cron Job 掃描清單，逗號分隔 (e.g. "2330,2317")
```

## 主要外部服務

| 服務 | 用途 | 主要檔案 |
|------|------|----------|
| FinMind | 台股價格、籌碼、財報 | `src/lib/providers/finmind.ts` |
| TWSE OpenAPI | 董監事申報轉讓 | `src/lib/providers/twseInsiderFetch.ts` |
| TradingView | RSI, MACD 等技術指標 | `src/lib/providers/tradingViewFetch.ts` |
| Yahoo Finance | 美股/宏觀指數 (VIX, DXY) | `src/lib/providers/yahooFetch.ts` |
| Upstash Redis | 快取層 | `src/lib/providers/redisCache.ts` |
| Groq API | 主 LLM 推論 | `src/lib/ai/playbookAgent.ts` |
| Google Gemini | 備援 LLM | `src/lib/ai/playbookAgent.ts` |

## 測試

- **框架**: Vitest
- **位置**: `src/lib/__tests__/` 及各模組內 `__tests__/` 目錄
- **覆蓋範圍**: 趨勢/流量信號計算、新聞分類、崩盤預警、Ticker 正規化

## 開發注意事項

- **Ticker 正規化**: 台股 4 位數字自動轉為 `{ticker}.TW` 格式，見 `src/lib/ticker.ts`
- **Watchlist**: 純前端 LocalStorage，見 `src/lib/stores/watchlistStore.ts`
- **腳本**: `scripts/` 目錄下驗證腳本使用獨立的 `scripts/tsconfig.selfcheck.json`，與主專案 tsconfig 分離
- **AI 評論**: 80 字限制，使用台股俚語風格，見 `src/lib/ai/stockAnalyst.ts`
- **預設股票**: 首頁預設顯示台積電 (2330)
