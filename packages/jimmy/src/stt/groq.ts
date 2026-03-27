import fs from "node:fs";
import path from "node:path";
import { logger } from "../shared/logger.js";

const GROQ_API_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const GROQ_MODEL = "whisper-large-v3-turbo";

/**
 * Transcribe an audio file using the Groq Whisper API.
 * Requires GROQ_API_KEY environment variable.
 */
export async function transcribeWithGroq(
  audioPath: string,
  language?: string,
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY environment variable is not set");
  }

  const filename = path.basename(audioPath);
  const fileBuffer = fs.readFileSync(audioPath);
  const blob = new Blob([fileBuffer]);

  const form = new FormData();
  form.append("file", blob, filename);
  form.append("model", GROQ_MODEL);
  if (language) {
    form.append("language", language);
  }

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Groq API error ${response.status}: ${errText}`);
  }

  const result = (await response.json()) as { text?: string };
  return (result.text ?? "").trim();
}

/** Check if Groq STT is available (API key is set). */
export function isGroqAvailable(): boolean {
  return !!process.env.GROQ_API_KEY;
}
