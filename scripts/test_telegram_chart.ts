import { handleTelegramMessage } from "../src/lib/telegram/botEngine";
import * as dotenv from "dotenv";
import path from "path";

// 載入 .env 檔案
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function main() {
  const chatId = Number(process.env.TELEGRAM_CHAT_ID);
  if (!chatId) {
    console.error("Missing TELEGRAM_CHAT_ID in .env");
    process.exit(1);
  }

  console.log(`Sending /tw 2330 to Chat ID: ${chatId}...`);
  
  const options = {
    baseUrl: process.env.BOT_BASE_URL || "https://tw-stock-health-dashboard.vercel.app" 
  };

  try {
    await handleTelegramMessage(chatId, "/tw 2330", false, options);
    console.log("Done.");
  } catch (error) {
    console.error("Error sending message:", error);
  }
}

main();
