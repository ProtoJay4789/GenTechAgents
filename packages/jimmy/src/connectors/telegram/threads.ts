export interface TelegramMessage {
  message_id: number;
  from?: { id: number; is_bot: boolean; username?: string };
  chat: { id: number; type: "private" | "group" | "supergroup" | "channel"; title?: string; username?: string };
  date: number;
  text?: string;
  reply_to_message?: TelegramMessage;
}

export function deriveSessionKey(msg: TelegramMessage): string {
  if (msg.chat.type === "private") {
    return `telegram:dm:${msg.from?.id ?? msg.chat.id}`;
  }
  // Group/supergroup: one session per group chat
  return `telegram:${msg.chat.id}`;
}

export function buildReplyContext(msg: TelegramMessage): Record<string, string | number | null> {
  return {
    channel: String(msg.chat.id),
    thread: null,
    messageTs: String(msg.message_id),
    chatType: msg.chat.type,
  };
}

export function isOldMessage(dateUnix: number, bootTimeMs: number): boolean {
  return dateUnix * 1000 < bootTimeMs;
}
