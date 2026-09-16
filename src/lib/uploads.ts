import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Owner-uploaded gift photos.
 *
 * Stored outside `public/` and served by a route handler: files written at
 * runtime into `public/` are not served after a production build, so that
 * approach works locally and breaks on deploy.
 */

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");
const MAX_BYTES = 8_000_000;

// SVG is deliberately absent: it can carry script, and these are displayed
// on a page shared with strangers.
const TYPES = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
} as const;

type Extension = keyof typeof TYPES;

/** Stored file names, so a request can never escape the upload directory. */
const FILENAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|gif|avif)$/;

/**
 * Identifies the format from the bytes themselves. A browser's declared
 * content-type is attacker-controlled and tells us nothing trustworthy.
 */
function sniff(bytes: Uint8Array): Extension | null {
  const starts = (...signature: number[]) =>
    signature.every((byte, index) => bytes[index] === byte);

  if (starts(0xff, 0xd8, 0xff)) return "jpg";
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "png";
  if (starts(0x47, 0x49, 0x46, 0x38)) return "gif";

  const ascii = (offset: number, text: string) =>
    [...text].every((char, index) => bytes[offset + index] === char.charCodeAt(0));

  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return "webp";
  if (ascii(4, "ftyp") && (ascii(8, "avif") || ascii(8, "avis"))) return "avif";

  return null;
}

export type UploadResult = { url: string } | { error: string };

export async function saveUpload(file: File): Promise<UploadResult> {
  if (file.size === 0) return { error: "That file was empty." };
  if (file.size > MAX_BYTES) {
    return { error: "That image is larger than 8MB — try a smaller one." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const extension = sniff(bytes);
  if (!extension) {
    return { error: "That doesn't look like a JPEG, PNG, WebP, GIF or AVIF." };
  }

  const name = `${crypto.randomUUID()}.${extension}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, name), bytes);

  return { url: `/uploads/${name}` };
}

export async function readUpload(
  name: string,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  if (!FILENAME.test(name)) return null;

  const extension = name.split(".").pop() as Extension;
  try {
    // The name is pattern-checked above, so this cannot traverse out of the dir.
    const bytes = await readFile(path.join(UPLOAD_DIR, name));
    return { bytes, contentType: TYPES[extension] };
  } catch {
    return null;
  }
}
