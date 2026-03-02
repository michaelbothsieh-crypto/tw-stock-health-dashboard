import { NextRequest, NextResponse } from "next/server";
import { generateBotReply } from "@/lib/telegram/botEngine";
import * as line from "@line/bot-sdk";

// LINE credentials
const config = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || "",
    channelSecret: process.env.LINE_CHANNEL_SECRET || "",
};

const client = new line.messagingApi.MessagingApiClient({
    channelAccessToken: config.channelAccessToken,
});

export async function POST(req: NextRequest) {
    try {
        // 1. Get raw body string for signature validation
        const rawBody = await req.text();
        const signature = req.headers.get("x-line-signature") || "";

        // 2. Validate signature
        if (!line.validateSignature(rawBody, config.channelSecret, signature)) {
            console.error("[LINE Webhook] Invalid signature");
            return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
        }

        // 3. Parse JSON body
        const body = JSON.parse(rawBody);
        const events: line.WebhookEvent[] = body.events;

        if (!events || events.length === 0) {
            return NextResponse.json({ status: "success" }, { status: 200 });
        }

        // 4. Process each event
        for (const event of events) {
            if (event.type !== "message" || event.message.type !== "text") {
                continue;
            }

            const userText = event.message.text;

            // Only respond to recognized commands or text starting with '/'
            if (!userText.startsWith("/")) {
                continue;
            }

            // Generate reply using the extracted botEngine logic
            const reply = await generateBotReply(userText);

            if (reply) {
                // Strip HTML tags and markdown asterisks for LINE text format
                const cleanReply = reply.text
                    .replace(/<[^>]*>?/gm, "")
                    .replace(/\*/g, "");

                const messages: line.messagingApi.Message[] = [];

                if (reply.photoUrl && (userText.startsWith("/stock") || userText.startsWith("/tw"))) {
                    messages.push({
                        type: "image",
                        originalContentUrl: reply.photoUrl,
                        previewImageUrl: reply.photoUrl,
                    });
                }

                messages.push({
                    type: "text",
                    text: cleanReply,
                });

                // Send reply to LINE user
                await client.replyMessage({
                    replyToken: event.replyToken,
                    messages,
                });
            }
        }

        return NextResponse.json({ status: "success" }, { status: 200 });

    } catch (error) {
        console.error("[LINE Webhook] Error processing event:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
