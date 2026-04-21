
import { CommandHandler, CommandContext, BotReply } from "./types";
import { StockHandler } from "@/features/telegram/handlers/StockHandler";
import { EtfHandler } from "@/features/telegram/handlers/EtfHandler";
import { HotHandler } from "@/features/telegram/handlers/HotHandler";
import { RankHandler } from "@/features/telegram/handlers/RankHandler";
import { ROIHandler } from "@/features/telegram/handlers/ROIHandler";
import { WhatIsHandler } from "@/features/telegram/handlers/WhatIsHandler";
import { TrendRankHandler } from "@/features/telegram/handlers/TrendRankHandler";

export class CommandRouter {
  private handlers: CommandHandler[] = [];

  constructor() {
    this.handlers.push(new StockHandler());
    this.handlers.push(new EtfHandler());
    this.handlers.push(new HotHandler());
    this.handlers.push(new RankHandler());
    this.handlers.push(new ROIHandler());
    this.handlers.push(new WhatIsHandler());
    this.handlers.push(new TrendRankHandler());
  }

  async route(command: string, ctx: CommandContext): Promise<BotReply | null> {
    const handler = this.handlers.find(h => h.canHandle(command));
    if (handler) {
      return await handler.handle({ ...ctx, command });
    }
    return null;
  }
}

export const commandRouter = new CommandRouter();
