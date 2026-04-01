import type { InterruptibleEngine, EngineRunOpts, EngineResult } from "../shared/types.js";
import { logger } from "../shared/logger.js";

const DEFAULT_BASE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
const DEFAULT_MODEL = "qwen-plus";

interface ActiveRequest {
  abort: AbortController;
  terminationReason: string | null;
}

/**
 * Qwen engine — calls Alibaba DashScope's OpenAI-compatible API.
 *
 * Setup:
 *   Set QWEN_API_KEY in ~/.jinn/.env (or environment).
 *   Optionally set QWEN_BASE_URL to use a different region:
 *     - International: https://dashscope-intl.aliyuncs.com/compatible-mode/v1
 *     - China:         https://dashscope.aliyuncs.com/compatible-mode/v1
 *     - US (Virginia): https://dashscope-us.aliyuncs.com/compatible-mode/v1
 *
 * Config (config.yaml):
 *   engines:
 *     qwen:
 *       model: qwen-plus    # or qwen-max, qwen3.5-plus, etc.
 */
export class QwenEngine implements InterruptibleEngine {
  name = "qwen" as const;
  private activeRequests = new Map<string, ActiveRequest>();

  kill(sessionId: string, reason = "Interrupted"): void {
    const req = this.activeRequests.get(sessionId);
    if (!req) return;
    req.terminationReason = reason;
    logger.info(`Aborting Qwen request for session ${sessionId}: ${reason}`);
    req.abort.abort();
  }

  killAll(): void {
    for (const sessionId of this.activeRequests.keys()) {
      this.kill(sessionId, "Interrupted: gateway shutting down");
    }
  }

  isAlive(sessionId: string): boolean {
    return this.activeRequests.has(sessionId);
  }

  async run(opts: EngineRunOpts): Promise<EngineResult> {
    const start = Date.now();
    const sessionId = opts.sessionId || `qwen-${Date.now()}`;
    const abort = new AbortController();
    this.activeRequests.set(sessionId, { abort, terminationReason: null });

    const apiKey = process.env.QWEN_API_KEY;
    if (!apiKey) {
      this.activeRequests.delete(sessionId);
      return {
        sessionId,
        result: "",
        error: "QWEN_API_KEY environment variable is not set. Add it to ~/.jinn/.env",
        durationMs: Date.now() - start,
      };
    }

    const baseUrl = (process.env.QWEN_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
    const model = opts.model || DEFAULT_MODEL;
    const effortLevel = opts.effortLevel || "medium";

    const messages: { role: string; content: string }[] = [];
    if (opts.systemPrompt) {
      messages.push({ role: "system", content: opts.systemPrompt });
    }

    let userContent = opts.prompt;
    if (opts.attachments?.length) {
      userContent += "\n\nAttached files:\n" + opts.attachments.map((a) => `- ${a}`).join("\n");
    }
    messages.push({ role: "user", content: userContent });

    // Enable extended thinking for high effort — Qwen3.5 supports enable_thinking
    const enableThinking = effortLevel === "high";

    const requestBody: Record<string, unknown> = {
      model,
      messages,
      stream: true,
    };
    if (enableThinking) {
      requestBody.enable_thinking = true;
    }

    logger.info(
      `Qwen engine starting: model=${model} effort=${effortLevel} thinking=${enableThinking} session=${sessionId}`,
    );

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Accept": "text/event-stream",
        },
        body: JSON.stringify(requestBody),
        signal: abort.signal,
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "(unreadable)");
        const errMsg = `Qwen API error ${response.status}: ${errText}`;
        logger.error(`[qwen] ${errMsg}`);
        this.activeRequests.delete(sessionId);
        return { sessionId, result: "", error: errMsg, durationMs: Date.now() - start };
      }

      let result = "";
      const onStream = opts.onStream ?? null;

      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buf += decoder.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() ?? "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed === "data: [DONE]") continue;
              if (!trimmed.startsWith("data: ")) continue;

              try {
                const json = JSON.parse(trimmed.slice(6)) as Record<string, unknown>;
                const choices = json.choices as Array<Record<string, unknown>> | undefined;
                const delta = choices?.[0]?.delta as Record<string, unknown> | undefined;
                if (!delta) continue;

                // Main text content
                if (typeof delta.content === "string" && delta.content) {
                  result += delta.content;
                  onStream?.({ type: "text", content: delta.content });
                }

                // Extended thinking / reasoning tokens (Qwen3.5)
                if (typeof delta.reasoning_content === "string" && delta.reasoning_content) {
                  onStream?.({ type: "status", content: delta.reasoning_content });
                }
              } catch {
                // Skip unparseable SSE lines
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      }

      const terminationReason = this.activeRequests.get(sessionId)?.terminationReason ?? null;
      this.activeRequests.delete(sessionId);
      const durationMs = Date.now() - start;

      logger.info(`Qwen engine completed session ${sessionId} in ${durationMs}ms`);

      return {
        sessionId,
        result,
        durationMs,
        error: terminationReason ?? undefined,
      };
    } catch (err) {
      const terminationReason = this.activeRequests.get(sessionId)?.terminationReason ?? null;
      this.activeRequests.delete(sessionId);
      const durationMs = Date.now() - start;

      if (err instanceof Error && err.name === "AbortError") {
        return {
          sessionId,
          result: "",
          error: terminationReason || "Interrupted",
          durationMs,
        };
      }

      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error(`Qwen engine error for session ${sessionId}: ${errMsg}`);
      return { sessionId, result: "", error: errMsg, durationMs };
    }
  }
}
