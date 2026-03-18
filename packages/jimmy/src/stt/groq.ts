import fs from "node:fs";
import path from "node:path";
import { logger } from "../shared/logger.js";

const GROQ_API_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const DEFAULT_MODEL = "whisper-large-v3-turbo";

/**
 * Transcribe an audio file using Groq's Whisper API.
 * Accepts any format Groq supports (ogg, mp3, wav, mp4, etc.).
 */
export async function transcribeWithGroq(
  audioPath: string,
  apiKey: string,
  language?: string,
): Promise<string> {
  const fileBuffer = fs.readFileSync(audioPath);
  const filename = path.basename(audioPath);

  const form = new FormData();
  form.append("file", new Blob([fileBuffer]), filename);
  form.append("model", DEFAULT_MODEL);
  if (language) {
    form.append("language", language);
  }

  logger.info(`Groq STT: transcribing ${filename} (${fileBuffer.length} bytes)`);

  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "unknown error");
    throw new Error(`Groq STT API error ${res.status}: ${errorText}`);
  }

  const data = (await res.json()) as { text: string };
  return data.text.trim();
}
