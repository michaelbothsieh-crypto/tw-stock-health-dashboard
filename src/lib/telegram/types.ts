
export interface BotReply {
  text: string;
  chartBuffer?: Buffer | null;
  chartBuffers?: Buffer[];
}

export interface CommandContext {
  command: string;
  query: string;
  chatId?: string | number;
  baseUrl?: string;
}

export interface CommandHandler {
  canHandle(command: string): boolean;
  handle(ctx: CommandContext): Promise<BotReply | null>;
}
