
const TOKEN = "8258745740:AAHJLNvpmdxdRiO-rEra9wg0V7_WC95x7qs";
const APP_URL = "https://tw-stock-health-dashboard.vercel.app";
const WEBHOOK_URL = `${APP_URL}/api/telegram/webhook`;

async function setup() {
    console.log(`Setting up Telegram Bot: ${TOKEN}`);

    // 1. Set Webhook
    const webhookRes = await fetch(`https://api.telegram.org/bot${TOKEN}/setWebhook?url=${WEBHOOK_URL}`);
    const webhookResult = await webhookRes.json();
    console.log("Set Webhook Result:", webhookResult);

    // 2. Set Commands
    const commandsRes = await fetch(`https://api.telegram.org/bot${TOKEN}/setMyCommands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            commands: [
                { command: "tw", description: "查詢台股診斷 (例: /tw 2330)" }
            ]
        })
    });
    const commandsResult = await commandsRes.json();
    console.log("Set Commands Result:", commandsResult);

    if (webhookResult.ok && commandsResult.ok) {
        console.log("SUCCESS: Webhook and Commands are configured!");
    } else {
        console.error("FAILURE: Setup might have issues.");
    }
}

setup().catch(console.error);
