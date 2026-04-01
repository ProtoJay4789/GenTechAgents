import { randomUUID } from "node:crypto";
import type { Engine, EngineRunOpts, EngineResult, StreamDelta } from "../shared/types.js";
import { logger } from "../shared/logger.js";

/**
 * Qwen engine — calls the DashScope OpenAI-compatible API directly.
 * No CLI wrapper needed; uses fetch against the HTTP API.
 *
 * Supports streaming via SSE and non-streaming via JSON response.
 * Requires QWEN_API_KEY environment variable.
 */
export class QwenEngine implements Engine {
  name = "qwen" as const;

  private readonly baseUrl = "https://dashscope.aliyuncs.com/compatible-mode/v1";

  async run(opts: EngineRunOpts): Promise<EngineResult> {
    const apiKey = process.env.QWEN_API_KEY;
    if (!apiKey) {
      return {
        sessionId: "",
        result: "",
        error: "QWEN_API_KEY not set. Add it to ~/.jinn/.env",
      };
    }

    const model = opts.model || "qwen-plus";
    const sessionId = opts.sessionId || `qwen-${randomUUID().slice(0, 8)}`;
    const streaming = !!opts.onStream;

    let prompt = opts.prompt;
    if (opts.attachments?.length) {
      prompt += "\n\nAttached files:\n" + opts.attachments.map((a) => `- ${a}`).join("\n");
    }

    const messages: { role: string; content: string }[] = [];
    if (opts.systemPrompt) {
      messages.push({ role: "system", content: opts.systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    const startTime = Date.now();

    logger.info(
      `Qwen engine starting: model=${model} streaming=${streaming} (session: ${sessionId})`,
    );

    try {
      if (streaming && opts.onStream) {
        return await this.runStreaming(apiKey, model, messages, sessionId, startTime, opts.onStream);
      }
      return await this.runNonStreaming(apiKey, model, messages, sessionId, startTime);
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`Qwen engine error: ${errorMsg}`);
      return {
        sessionId,
        result: "",
        error: errorMsg,
        durationMs,
      };
    }
  }

  private async runNonStreaming(
    apiKey: string,
    model: string,
    messages: { role: string; content: string }[],
    sessionId: string,
    startTime: number,
  ): Promise<EngineResult> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, stream: false }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Qwen API ${res.status}: ${body}`);
    }

    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
      usage?: { total_tokens?: number; prompt_tokens?: number; completion_tokens?: number };
    };

    const result = data.choices?.[0]?.message?.content || "";
    const durationMs = Date.now() - startTime;

    // Estimate cost (Qwen Plus: ~$0.0008/1K input, $0.002/1K output)
    const usage = data.usage;
    let cost: number | undefined;
    if (usage?.prompt_tokens && usage?.completion_tokens) {
      cost = (usage.prompt_tokens * 0.0008 + usage.completion_tokens * 0.002) / 1000;
    }

    logger.info(`Qwen engine completed in ${durationMs}ms (model: ${model})`);

    return {
      sessionId,
      result,
      cost,
      durationMs,
      numTurns: 1,
    };
  }

  private async runStreaming(
    apiKey: string,
    model: string,
    messages: { role: string; content: string }[],
    sessionId: string,
    startTime: number,
    onStream: (delta: StreamDelta) => void,
  ): Promise<EngineResult> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, stream: true }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Qwen API ${res.status}: ${body}`);
    }

    let fullResult = "";
    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") continue;

        try {
          const chunk = JSON.parse(payload) as {
            choices: { delta: { content?: string } }[];
          };
          const content = chunk.choices?.[0]?.delta?.content;
          if (content) {
            fullResult += content;
            onStream({ type: "text", content });
          }
        } catch {
          // skip malformed chunks
        }
      }
    }

    const durationMs = Date.now() - startTime;
    logger.info(`Qwen engine (streaming) completed in ${durationMs}ms (model: ${model})`);

    return {
      sessionId,
      result: fullResult,
      durationMs,
      numTurns: 1,
    };
  }
}
