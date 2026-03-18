import TelegramBot from "node-telegram-bot-api";
import type {
  Connector,
  ConnectorCapabilities,
  ConnectorHealth,
  IncomingMessage,
  ReplyContext,
  Target,
  TelegramConnectorConfig,
} from "../../shared/types.js";
import { deriveSessionKey, buildReplyContext, isOldMessage } from "./threads.js";
import type { TelegramMessage } from "./threads.js";
import { formatResponse, downloadAttachment } from "./format.js";
import { TMP_DIR } from "../../shared/paths.js";
import { logger } from "../../shared/logger.js";
import { randomUUID } from "node:crypto";

export class TelegramConnector implements Connector {
  name = "telegram";
  private bot: TelegramBot;
  private handler: ((msg: IncomingMessage) => void) | null = null;
  private readonly allowedUsers: Set<string> | null;
  private readonly ignoreOldMessagesOnBoot: boolean;
  private readonly bootTimeMs = Date.now();
  private started = false;
  private lastError: string | null = null;
  private readonly botToken: string;

  private readonly capabilities: ConnectorCapabilities = {
    threading: false,
    messageEdits: true,
    reactions: false,
    attachments: true,
  };

  constructor(config: TelegramConnectorConfig) {
    this.botToken = config.botToken;
    this.bot = new TelegramBot(config.botToken, { polling: true });
    this.ignoreOldMessagesOnBoot = config.ignoreOldMessagesOnBoot !== false;
    const allowFrom = Array.isArray(config.allowFrom)
      ? config.allowFrom
      : typeof config.allowFrom === "string"
        ? config.allowFrom.split(",").map((v) => v.trim()).filter(Boolean)
        : [];
    this.allowedUsers = allowFrom.length > 0 ? new Set(allowFrom) : null;
  }

  async start() {
    this.bot.on("message", async (msg) => {
      const tmsg = msg as unknown as TelegramMessage;
      logger.info(`[telegram] Received message: user=${tmsg.from?.id} chat=${tmsg.chat.id} text="${(tmsg.text || "").slice(0, 50)}"`);

      // Skip bot messages
      if (tmsg.from?.is_bot) {
        logger.debug("[telegram] Skipping bot message");
        return;
      }
      if (!this.handler) {
        logger.debug("[telegram] No handler registered, dropping message");
        return;
      }
      if (this.ignoreOldMessagesOnBoot && isOldMessage(tmsg.date, this.bootTimeMs)) {
        logger.debug(`[telegram] Ignoring old message ${tmsg.message_id}`);
        return;
      }
      if (this.allowedUsers && tmsg.from && !this.allowedUsers.has(String(tmsg.from.id))) {
        logger.debug(`[telegram] Ignoring message from unauthorized user ${tmsg.from.id}`);
        return;
      }

      const text = tmsg.text || "";
      if (!text && !msg.document && !msg.photo) {
        logger.debug("[telegram] Skipping non-text message without attachments");
        return;
      }

      const sessionKey = deriveSessionKey(tmsg);
      const replyContext = buildReplyContext(tmsg);

      // Download attachments if present
      const attachments = [];
      if (msg.document) {
        try {
          const fileId = msg.document.file_id;
          const fileLink = await this.bot.getFileLink(fileId);
          const filename = `${randomUUID()}-${msg.document.file_name || "file"}`;
          const localPath = await downloadAttachment(fileLink, TMP_DIR, filename);
          attachments.push({
            name: msg.document.file_name || "file",
            url: fileLink,
            mimeType: msg.document.mime_type || "application/octet-stream",
            localPath,
          });
        } catch (err) {
          logger.warn(`[telegram] Failed to download document: ${err}`);
        }
      }
      if (msg.photo && msg.photo.length > 0) {
        try {
          // Get the highest resolution photo
          const photo = msg.photo[msg.photo.length - 1];
          const fileLink = await this.bot.getFileLink(photo.file_id);
          const filename = `${randomUUID()}.jpg`;
          const localPath = await downloadAttachment(fileLink, TMP_DIR, filename);
          attachments.push({
            name: filename,
            url: fileLink,
            mimeType: "image/jpeg",
            localPath,
          });
        } catch (err) {
          logger.warn(`[telegram] Failed to download photo: ${err}`);
        }
      }

      const chatTitle = tmsg.chat.title || tmsg.chat.username || String(tmsg.chat.id);

      const incoming: IncomingMessage = {
        connector: this.name,
        source: "telegram",
        sessionKey,
        replyContext: replyContext as unknown as ReplyContext,
        messageId: String(tmsg.message_id),
        channel: String(tmsg.chat.id),
        thread: undefined,
        user: tmsg.from?.username || String(tmsg.from?.id ?? "unknown"),
        userId: String(tmsg.from?.id ?? "unknown"),
        text: (msg.caption ? `${msg.caption}\n` : "") + text,
        attachments,
        raw: msg,
        transportMeta: {
          chatType: tmsg.chat.type,
          chatTitle,
        },
      };

      this.handler(incoming);
    });

    this.bot.on("polling_error", (err) => {
      this.lastError = err.message;
      logger.error(`[telegram] Polling error: ${err.message}`);
    });

    this.started = true;
    this.lastError = null;
    logger.info("Telegram connector started (polling mode)");
  }

  async stop() {
    await this.bot.stopPolling();
    this.started = false;
    logger.info("Telegram connector stopped");
  }

  getCapabilities(): ConnectorCapabilities {
    return this.capabilities;
  }

  getHealth(): ConnectorHealth {
    return {
      status: this.lastError ? "error" : this.started ? "running" : "stopped",
      detail: this.lastError ?? undefined,
      capabilities: this.capabilities,
    };
  }

  reconstructTarget(replyContext: ReplyContext): Target {
    return {
      channel: typeof replyContext.channel === "string" ? replyContext.channel : "",
      thread: undefined,
      messageTs: typeof replyContext.messageTs === "string" ? replyContext.messageTs : undefined,
      replyContext,
    };
  }

  async sendMessage(target: Target, text: string): Promise<string | undefined> {
    if (!text || !text.trim()) return undefined;
    const chunks = formatResponse(text);
    let lastMsgId: string | undefined;
    for (const chunk of chunks) {
      if (!chunk.trim()) continue;
      const sent = await this.bot.sendMessage(Number(target.channel), chunk, {
        parse_mode: undefined,
      });
      lastMsgId = String(sent.message_id);
    }
    return lastMsgId;
  }

  async replyMessage(target: Target, text: string): Promise<string | undefined> {
    if (!text || !text.trim()) return undefined;
    const replyToId = target.messageTs ? Number(target.messageTs) : undefined;
    const chunks = formatResponse(text);
    let lastMsgId: string | undefined;
    for (const chunk of chunks) {
      if (!chunk.trim()) continue;
      const sent = await this.bot.sendMessage(Number(target.channel), chunk, {
        reply_to_message_id: replyToId,
      });
      lastMsgId = String(sent.message_id);
    }
    return lastMsgId;
  }

  async addReaction(_target: Target, _emoji: string): Promise<void> {
    // Telegram Bot API has limited reaction support; no-op for now
  }

  async removeReaction(_target: Target, _emoji: string): Promise<void> {
    // No-op
  }

  async editMessage(target: Target, text: string): Promise<void> {
    if (!target.messageTs) return;
    if (!text || !text.trim()) return;
    try {
      await this.bot.editMessageText(text, {
        chat_id: Number(target.channel),
        message_id: Number(target.messageTs),
      });
    } catch (err) {
      logger.warn(`[telegram] Failed to edit message: ${err}`);
    }
  }

  async setTypingStatus(channelId: string): Promise<void> {
    try {
      await this.bot.sendChatAction(Number(channelId), "typing");
    } catch (err) {
      logger.debug(`[telegram] Typing status failed: ${err}`);
    }
  }

  onMessage(handler: (msg: IncomingMessage) => void) {
    this.handler = handler;
  }
}
