import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { IncomingMessage, Target } from "../../../shared/types.js";

// Mock node-telegram-bot-api before importing connector
const mockSendMessage = vi.fn().mockResolvedValue({ message_id: 1 });
const mockEditMessageText = vi.fn().mockResolvedValue(true);
const mockGetMe = vi.fn().mockResolvedValue({ id: 999, username: "test_bot" });
const mockStartPolling = vi.fn();
const mockStopPolling = vi.fn().mockResolvedValue(undefined);
const mockOn = vi.fn();
const mockGetFileLink = vi.fn().mockResolvedValue("https://api.telegram.org/file/bot123/voice.ogg");

vi.mock("node-telegram-bot-api", () => {
  const MockBot = vi.fn(function (this: any) {
    this.sendMessage = mockSendMessage;
    this.editMessageText = mockEditMessageText;
    this.getMe = mockGetMe;
    this.startPolling = mockStartPolling;
    this.stopPolling = mockStopPolling;
    this.on = mockOn;
    this.getFileLink = mockGetFileLink;
  });
  return { default: MockBot };
});

vi.mock("../../../shared/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../../shared/paths.js", () => ({
  TMP_DIR: "/tmp/test-jinn",
}));

const mockTranscribeWithGroq = vi.fn().mockResolvedValue("transcribed text");
const mockIsGroqAvailable = vi.fn().mockReturnValue(true);

vi.mock("../../../stt/groq.js", () => ({
  transcribeWithGroq: (...args: any[]) => mockTranscribeWithGroq(...args),
  isGroqAvailable: () => mockIsGroqAvailable(),
}));

vi.mock("node:fs", () => ({
  default: {
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
}));

// Mock global fetch for file downloads
const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
});
vi.stubGlobal("fetch", mockFetch);

// Import after mocks are set up
const { TelegramConnector } = await import("../index.js");

/** Helper to get the message callback registered via bot.on("message", ...) */
function getMessageCallback() {
  return mockOn.mock.calls.find((call) => call[0] === "message")?.[1];
}

describe("TelegramConnector", () => {
  let connector: InstanceType<typeof TelegramConnector>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFileLink.mockResolvedValue("https://api.telegram.org/file/bot123/voice.ogg");
    mockTranscribeWithGroq.mockResolvedValue("transcribed text");
    mockIsGroqAvailable.mockReturnValue(true);
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
    });
    connector = new TelegramConnector({
      botToken: "123456:ABC-DEF",
    });
  });

  describe("constructor", () => {
    it("sets the connector name to telegram", () => {
      expect(connector.name).toBe("telegram");
    });
  });

  describe("getCapabilities", () => {
    it("returns correct capabilities", () => {
      expect(connector.getCapabilities()).toEqual({
        threading: false,
        messageEdits: true,
        reactions: false,
        attachments: true,
      });
    });
  });

  describe("getHealth", () => {
    it("returns stopped before start", () => {
      const health = connector.getHealth();
      expect(health.status).toBe("stopped");
    });
  });

  describe("start", () => {
    it("registers message handler and starts polling after validation", async () => {
      await connector.start();
      const health = connector.getHealth();
      expect(health.status).toBe("running");
      expect(mockGetMe).toHaveBeenCalledOnce();
      expect(mockStartPolling).toHaveBeenCalledOnce();
      expect(mockOn).toHaveBeenCalledWith("message", expect.any(Function));
    });

    it("does not start polling if getMe fails (invalid token)", async () => {
      mockGetMe.mockRejectedValueOnce(new Error("Invalid token"));
      await connector.start();
      const health = connector.getHealth();
      expect(health.status).toBe("error");
      expect(health.detail).toContain("Invalid token");
      expect(mockStartPolling).not.toHaveBeenCalled();
    });
  });

  describe("stop", () => {
    it("stops polling and sets stopped state", async () => {
      await connector.start();
      await connector.stop();
      expect(mockStopPolling).toHaveBeenCalledOnce();
      expect(connector.getHealth().status).toBe("stopped");
    });
  });

  describe("onMessage", () => {
    it("routes incoming messages to the handler", async () => {
      const handler = vi.fn();
      connector.onMessage(handler);
      await connector.start();

      const messageCallback = getMessageCallback();
      expect(messageCallback).toBeDefined();

      // Simulate incoming Telegram message
      const telegramMsg = {
        message_id: 42,
        chat: { id: 12345, type: "private" as const },
        from: { id: 67890, username: "testuser", first_name: "Test", is_bot: false },
        date: Math.floor(Date.now() / 1000) + 10,
        text: "Hello bot!",
      };
      await messageCallback(telegramMsg);

      expect(handler).toHaveBeenCalledOnce();
      const msg: IncomingMessage = handler.mock.calls[0][0];
      expect(msg.connector).toBe("telegram");
      expect(msg.source).toBe("telegram");
      expect(msg.sessionKey).toBe("telegram:12345");
      expect(msg.text).toBe("Hello bot!");
      expect(msg.user).toBe("testuser");
      expect(msg.userId).toBe("67890");
      expect(msg.channel).toBe("12345");
    });

    it("ignores messages from bots", async () => {
      const handler = vi.fn();
      connector.onMessage(handler);
      await connector.start();

      const messageCallback = getMessageCallback();

      const botMsg = {
        message_id: 1,
        chat: { id: 12345, type: "private" as const },
        from: { id: 999, username: "test_bot", first_name: "Bot", is_bot: true },
        date: Math.floor(Date.now() / 1000) + 10,
        text: "Bot message",
      };
      await messageCallback(botMsg);

      expect(handler).not.toHaveBeenCalled();
    });

    it("ignores messages from unauthorized users when allowFrom is set", async () => {
      const restricted = new TelegramConnector({
        botToken: "123456:ABC-DEF",
        allowFrom: [67890],
      });
      const handler = vi.fn();
      restricted.onMessage(handler);
      await restricted.start();

      const messageCallback = getMessageCallback();

      // Unauthorized user
      const msg = {
        message_id: 1,
        chat: { id: 11111, type: "private" as const },
        from: { id: 99999, username: "stranger", first_name: "Stranger", is_bot: false },
        date: Math.floor(Date.now() / 1000) + 10,
        text: "Hello",
      };
      await messageCallback(msg);
      expect(handler).not.toHaveBeenCalled();
    });

    it("rejects messages with from: undefined when allowFrom is set", async () => {
      const restricted = new TelegramConnector({
        botToken: "123456:ABC-DEF",
        allowFrom: [67890],
      });
      const handler = vi.fn();
      restricted.onMessage(handler);
      await restricted.start();

      const messageCallback = getMessageCallback();

      // Channel post or forwarded message with no `from`
      const msg = {
        message_id: 1,
        chat: { id: 11111, type: "channel" as const },
        date: Math.floor(Date.now() / 1000) + 10,
        text: "Channel post",
      };
      await messageCallback(msg);
      expect(handler).not.toHaveBeenCalled();
    });

    it("allows messages from authorized users through allowFrom", async () => {
      const restricted = new TelegramConnector({
        botToken: "123456:ABC-DEF",
        allowFrom: [67890],
      });
      const handler = vi.fn();
      restricted.onMessage(handler);
      await restricted.start();

      const messageCallback = getMessageCallback();

      const msg = {
        message_id: 1,
        chat: { id: 12345, type: "private" as const },
        from: { id: 67890, username: "allowed_user", first_name: "Allowed", is_bot: false },
        date: Math.floor(Date.now() / 1000) + 10,
        text: "Hello",
      };
      await messageCallback(msg);
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  describe("voice messages", () => {
    it("downloads and transcribes voice messages with Groq", async () => {
      const sttConnector = new TelegramConnector({
        botToken: "123456:ABC-DEF",
        stt: { enabled: true, languages: ["en"] },
      });
      const handler = vi.fn();
      sttConnector.onMessage(handler);
      await sttConnector.start();

      const messageCallback = getMessageCallback();

      const voiceMsg = {
        message_id: 50,
        chat: { id: 12345, type: "private" as const },
        from: { id: 67890, username: "testuser", first_name: "Test", is_bot: false },
        date: Math.floor(Date.now() / 1000) + 10,
        voice: { file_id: "voice_file_123", duration: 5, mime_type: "audio/ogg" },
      };
      await messageCallback(voiceMsg);

      expect(mockGetFileLink).toHaveBeenCalledWith("voice_file_123");
      expect(mockTranscribeWithGroq).toHaveBeenCalled();
      expect(handler).toHaveBeenCalledOnce();

      const msg: IncomingMessage = handler.mock.calls[0][0];
      expect(msg.text).toBe("transcribed text");
      expect(msg.attachments).toHaveLength(1);
      expect(msg.attachments[0].mimeType).toBe("audio/ogg");
      expect(msg.attachments[0].name).toContain("tg-voice-");
    });

    it("attaches voice file even when STT is unavailable", async () => {
      mockIsGroqAvailable.mockReturnValue(false);

      const handler = vi.fn();
      connector.onMessage(handler);
      await connector.start();

      const messageCallback = getMessageCallback();

      const voiceMsg = {
        message_id: 50,
        chat: { id: 12345, type: "private" as const },
        from: { id: 67890, username: "testuser", first_name: "Test", is_bot: false },
        date: Math.floor(Date.now() / 1000) + 10,
        voice: { file_id: "voice_file_123", duration: 5, mime_type: "audio/ogg" },
      };
      await messageCallback(voiceMsg);

      expect(mockTranscribeWithGroq).not.toHaveBeenCalled();
      expect(handler).toHaveBeenCalledOnce();

      const msg: IncomingMessage = handler.mock.calls[0][0];
      expect(msg.attachments).toHaveLength(1);
      expect(msg.attachments[0].mimeType).toBe("audio/ogg");
    });

    it("continues with attachment when STT transcription fails", async () => {
      mockTranscribeWithGroq.mockRejectedValueOnce(new Error("API error"));

      const sttConnector = new TelegramConnector({
        botToken: "123456:ABC-DEF",
        stt: { enabled: true },
      });
      const handler = vi.fn();
      sttConnector.onMessage(handler);
      await sttConnector.start();

      const messageCallback = getMessageCallback();

      const voiceMsg = {
        message_id: 50,
        chat: { id: 12345, type: "private" as const },
        from: { id: 67890, username: "testuser", first_name: "Test", is_bot: false },
        date: Math.floor(Date.now() / 1000) + 10,
        voice: { file_id: "voice_file_123", duration: 5, mime_type: "audio/ogg" },
      };
      await messageCallback(voiceMsg);

      expect(handler).toHaveBeenCalledOnce();
      const msg: IncomingMessage = handler.mock.calls[0][0];
      expect(msg.text).toBe("");
      expect(msg.attachments).toHaveLength(1);
    });
  });

  describe("photo messages", () => {
    it("downloads and attaches photos with caption as text", async () => {
      const handler = vi.fn();
      connector.onMessage(handler);
      await connector.start();

      const messageCallback = getMessageCallback();

      const photoMsg = {
        message_id: 60,
        chat: { id: 12345, type: "private" as const },
        from: { id: 67890, username: "testuser", first_name: "Test", is_bot: false },
        date: Math.floor(Date.now() / 1000) + 10,
        caption: "Check this out",
        photo: [
          { file_id: "small_photo", width: 90, height: 90 },
          { file_id: "medium_photo", width: 320, height: 320 },
          { file_id: "large_photo", width: 800, height: 800 },
        ],
      };
      await messageCallback(photoMsg);

      // Should download the largest photo (last in array)
      expect(mockGetFileLink).toHaveBeenCalledWith("large_photo");
      expect(handler).toHaveBeenCalledOnce();

      const msg: IncomingMessage = handler.mock.calls[0][0];
      expect(msg.text).toBe("Check this out");
      expect(msg.attachments).toHaveLength(1);
      expect(msg.attachments[0].mimeType).toBe("image/jpeg");
      expect(msg.attachments[0].name).toContain("tg-photo-");
    });

    it("handles photos without caption", async () => {
      const handler = vi.fn();
      connector.onMessage(handler);
      await connector.start();

      const messageCallback = getMessageCallback();

      const photoMsg = {
        message_id: 61,
        chat: { id: 12345, type: "private" as const },
        from: { id: 67890, username: "testuser", first_name: "Test", is_bot: false },
        date: Math.floor(Date.now() / 1000) + 10,
        photo: [
          { file_id: "photo_id", width: 800, height: 800 },
        ],
      };
      await messageCallback(photoMsg);

      expect(handler).toHaveBeenCalledOnce();
      const msg: IncomingMessage = handler.mock.calls[0][0];
      expect(msg.text).toBe("");
      expect(msg.attachments).toHaveLength(1);
    });
  });

  describe("document messages", () => {
    it("downloads and attaches documents", async () => {
      const handler = vi.fn();
      connector.onMessage(handler);
      await connector.start();

      const messageCallback = getMessageCallback();

      const docMsg = {
        message_id: 70,
        chat: { id: 12345, type: "private" as const },
        from: { id: 67890, username: "testuser", first_name: "Test", is_bot: false },
        date: Math.floor(Date.now() / 1000) + 10,
        caption: "Here is the report",
        document: {
          file_id: "doc_file_123",
          file_name: "report.pdf",
          mime_type: "application/pdf",
        },
      };
      await messageCallback(docMsg);

      expect(mockGetFileLink).toHaveBeenCalledWith("doc_file_123");
      expect(handler).toHaveBeenCalledOnce();

      const msg: IncomingMessage = handler.mock.calls[0][0];
      expect(msg.text).toBe("Here is the report");
      expect(msg.attachments).toHaveLength(1);
      expect(msg.attachments[0].name).toBe("report.pdf");
      expect(msg.attachments[0].mimeType).toBe("application/pdf");
    });
  });

  describe("media error handling", () => {
    it("skips messages with no text and no media", async () => {
      const handler = vi.fn();
      connector.onMessage(handler);
      await connector.start();

      const messageCallback = getMessageCallback();

      const emptyMsg = {
        message_id: 80,
        chat: { id: 12345, type: "private" as const },
        from: { id: 67890, username: "testuser", first_name: "Test", is_bot: false },
        date: Math.floor(Date.now() / 1000) + 10,
      };
      await messageCallback(emptyMsg);

      expect(handler).not.toHaveBeenCalled();
    });

    it("handles download failure gracefully", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const handler = vi.fn();
      connector.onMessage(handler);
      await connector.start();

      const messageCallback = getMessageCallback();

      const photoMsg = {
        message_id: 90,
        chat: { id: 12345, type: "private" as const },
        from: { id: 67890, username: "testuser", first_name: "Test", is_bot: false },
        date: Math.floor(Date.now() / 1000) + 10,
        caption: "A photo",
        photo: [{ file_id: "photo_id", width: 800, height: 800 }],
      };
      await messageCallback(photoMsg);

      // Should still call handler with the caption text even though download failed
      expect(handler).toHaveBeenCalledOnce();
      const msg: IncomingMessage = handler.mock.calls[0][0];
      expect(msg.text).toBe("A photo");
      expect(msg.attachments).toHaveLength(0);
    });
  });

  describe("sendMessage", () => {
    it("sends a message to the target chat", async () => {
      const target: Target = { channel: "12345" };
      await connector.sendMessage(target, "Hello!");
      expect(mockSendMessage).toHaveBeenCalledWith("12345", "Hello!", {
        parse_mode: "Markdown",
      });
    });

    it("does not send empty messages", async () => {
      const target: Target = { channel: "12345" };
      await connector.sendMessage(target, "");
      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it("chunks long messages", async () => {
      const target: Target = { channel: "12345" };
      const longText = "A".repeat(5000);
      await connector.sendMessage(target, longText);
      expect(mockSendMessage).toHaveBeenCalledTimes(2);
    });

    it("retries without parse_mode on Markdown parse error", async () => {
      mockSendMessage
        .mockRejectedValueOnce(new Error("Bad Request: can't parse entities"))
        .mockResolvedValueOnce({ message_id: 2 });
      const target: Target = { channel: "12345" };
      const result = await connector.sendMessage(target, "**bad markdown");
      // First call with Markdown, second without
      expect(mockSendMessage).toHaveBeenCalledTimes(2);
      expect(mockSendMessage.mock.calls[0][2]).toEqual({ parse_mode: "Markdown" });
      expect(mockSendMessage.mock.calls[1][2]).toEqual({});
      expect(result).toBe("2");
    });
  });

  describe("replyMessage", () => {
    it("sends a reply to a specific message", async () => {
      const target: Target = {
        channel: "12345",
        replyContext: { chatId: 12345, messageId: 42 },
      };
      await connector.replyMessage(target, "Reply!");
      expect(mockSendMessage).toHaveBeenCalledWith("12345", "Reply!", {
        parse_mode: "Markdown",
        reply_to_message_id: 42,
      });
    });
  });

  describe("editMessage", () => {
    it("edits an existing message", async () => {
      const target: Target = {
        channel: "12345",
        messageTs: "42",
      };
      await connector.editMessage(target, "Edited!");
      expect(mockEditMessageText).toHaveBeenCalledWith("Edited!", {
        chat_id: "12345",
        message_id: 42,
        parse_mode: "Markdown",
      });
    });
  });

  describe("reconstructTarget", () => {
    it("reconstructs target from reply context", () => {
      const target = connector.reconstructTarget({
        chatId: 12345,
        messageId: 42,
      });
      expect(target.channel).toBe("12345");
      expect(target.messageTs).toBe("42");
      expect(target.replyContext).toEqual({ chatId: 12345, messageId: 42 });
    });
  });
});
