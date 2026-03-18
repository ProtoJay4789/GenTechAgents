const TELEGRAM_MAX_LENGTH = 4096;

export function formatResponse(text: string): string[] {
  if (text.length <= TELEGRAM_MAX_LENGTH) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= TELEGRAM_MAX_LENGTH) {
      chunks.push(remaining);
      break;
    }
    let cutAt = remaining.lastIndexOf("\n", TELEGRAM_MAX_LENGTH);
    if (cutAt <= 0) cutAt = remaining.lastIndexOf(" ", TELEGRAM_MAX_LENGTH);
    if (cutAt <= 0) cutAt = TELEGRAM_MAX_LENGTH;
    chunks.push(remaining.slice(0, cutAt));
    remaining = remaining.slice(cutAt).trimStart();
  }
  return chunks;
}

export async function downloadAttachment(
  fileUrl: string,
  destDir: string,
  filename: string,
): Promise<string> {
  const { default: fs } = await import("node:fs");
  const { default: path } = await import("node:path");
  const destPath = path.join(destDir, filename);
  const res = await fetch(fileUrl);
  if (!res.ok) throw new Error(`Failed to download attachment: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
  return destPath;
}
