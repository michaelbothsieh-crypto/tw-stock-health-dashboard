import { fetchLatestReport } from "./reportFetcher";

async function sendMessage(chatId: number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("[TelegramBot] TELEGRAM_BOT_TOKEN is missing");
    return;
  }
  
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown"
      })
    });
    if (!res.ok) {
        console.error("[TelegramBot] Send Error:", await res.text());
    }
  } catch (error) {
    console.error("[TelegramBot] Network Error:", error);
  }
}

export async function handleTelegramMessage(chatId: number, text: string) {
  if (!text.startsWith("/")) return;

  const args = text.split(" ");
  const command = args[0].toLowerCase();
  
  if (command === "/help" || command === "/start") {
    const helpText = `📈 *台股健康診斷 - 小幫手*
歡迎使用！指令列表：

・/daily - 顯示今日收盤極簡總覽
・/stock <代號或名稱> - 查詢單檔詳細卡片 (例如: /stock 2330)
・/watchlist - 查看目前系統預設清單
・/help - 顯示此說明`;
    await sendMessage(chatId, helpText);
    return;
  }

  if (command === "/watchlist") {
     const wl = process.env.WATCHLIST_TW || "暫無系統預設";
     await sendMessage(chatId, `📝 *預設觀察清單*\n\n${wl}`);
     return;
  }

  if (command === "/daily" || command === "/stock") {
    let reportData: any;
    try {
       reportData = await fetchLatestReport();
    } catch (e: any) {
       await sendMessage(chatId, `⚠️ 讀取報告失敗，請確認設定: ${e.message}`);
       return;
    }

    if (!reportData || !reportData.watchlist) {
       await sendMessage(chatId, "目前尚未產出最新收盤報告，請稍後再試。");
       return;
    }

    if (command === "/daily") {
       let msg = `📊 *每日收盤極簡總覽* (${reportData.date})\n\n`;
       for (const r of reportData.watchlist) {
          if (r.predText === "—") {
             msg += `• ${r.nameZh}(${r.symbol}) ${r.changePct} ⚠️ 資料不足(法人不完整)\n`;
          } else {
             const dirText = r.predText === "微多" ? "偏多" : r.predText;
             msg += `• ${r.nameZh}(${r.symbol}) ${r.changePct}｜法人${r.flowTotal}｜${dirText} ${r.probText}｜3D ${r.h3Text.split(" ")[0]}｜5D ${r.h5Text.split(" ")[0]}\n`;
          }
       }
       await sendMessage(chatId, msg);
       return;
    }

    if (command === "/stock") {
       const search = args[1];
       if (!search) {
          await sendMessage(chatId, "請輸入股票代號或名稱，例如：/stock 2330");
          return;
       }

       const stock = reportData.watchlist.find((s: any) => 
          s.symbol === search || s.nameZh.includes(search)
       );

       if (!stock) {
          await sendMessage(chatId, "找不到該檔股票，請確認是否在觀察清單中。");
          return;
       }

       if (stock.predText === "—") {
          const warnText = `*${stock.symbol} ${stock.nameZh}*\n收盤：${stock.price !== null ? stock.price : "—"} (${stock.changePct})\n⚠️ 資料不足（法人未完整更新），暫無預測`;
          await sendMessage(chatId, warnText);
          return;
       }

       // Parse detail string manually constructed in daily report generator
       // to match user request spec cleanly
       const lines = stock.detailStr.split('\n');
       
       let card = `${stock.symbol} ${stock.nameZh}\n`;
       card += `收盤：${stock.price} (${stock.changePct})\n`;
       card += `法人合計：${stock.flowTotal}\n`;
       card += `預測：${stock.predText === "微多" ? "偏多" : stock.predText} (${stock.probText})\n`;
       card += `回測：3日 ${stock.h3Text}｜5日 ${stock.h5Text}\n`;
       
       // Risk sentence is in the detailStr last line natively "⚠️ 風險：..."
       const riskLine = lines.find((l: string) => l.includes("風險："));
       if (riskLine) {
          card += (riskLine.replace("> ", "")) + "\n";
       }

       await sendMessage(chatId, card);
       return;
    }
  }

  // Not recognized
  await sendMessage(chatId, "未知的指令。請輸入 /help 查看說明。");
}
