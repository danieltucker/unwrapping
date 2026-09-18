import "server-only";

import {
  mkdir,
  readdir,
  readFile,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import { formatBytes, uploads } from "@/config/site";

/**
 * Owner-uploaded gift photos.
 *
 * Stored outside `public/` and served by a route handler: files written at
 * runtime into `public/` are not served after a production build, so that
 * approach works locally and breaks on deploy.
 */

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

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
  if (file.size > uploads.maxBytes) {
    return {
      error: `That image is ${formatBytes(file.size)}. The limit is ${uploads.maxLabel}.`,
    };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const extension = sniff(bytes);
  if (!extension) {
    return { error: "That doesn't look like a JPEG, PNG, WebP, GIF or AVIF." };
  }

  const name = `${crypto.randomUUID()}.${extension}`;

  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(path.join(UPLOAD_DIR, name), bytes);
  } catch (error) {
    // A full disk, or a data directory the container cannot write to — the
    // usual first-run mistake when self-hosting. Answered rather than thrown,
    // so the owner gets a sentence in the panel and the operator gets the
    // reason in the log; see docs/self-hosting.md on permissions.
    console.error(`[upload] could not write ${name}:`, error);
    return { error: "We couldn't save that photo. Try again in a moment." };
  }

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

/** One file on disk, as the admin screen lists it. */
export type StoredUpload = {
  name: string;
  /** What a page would reference it by, so callers can match it to a row. */
  url: string;
  bytes: number;
  uploadedAt: Date;
};

/**
 * Every photo on disk, newest first.
 *
 * The directory *is* the index: nothing records an upload in the database, so
 * there is no table to read and no chance of the two disagreeing. Files that
 * don't match the stored-name pattern are skipped rather than listed — anything
 * else in there was put there by hand, and this screen can delete things.
 *
 * Reads the whole directory and stats each entry, which is fine at the scale
 * this runs at: one household's gift photos, not a media library.
 */
export async function listUploads(): Promise<StoredUpload[]> {
  let names: string[];
  try {
    names = await readdir(UPLOAD_DIR);
  } catch {
    // Nothing has ever been uploaded, so the directory doesn't exist yet.
    return [];
  }

  const found = await Promise.all(
    names
      .filter((name) => FILENAME.test(name))
      .map(async (name) => {
        try {
          const info = await stat(path.join(UPLOAD_DIR, name));
          return {
            name,
            url: `/uploads/${name}`,
            bytes: info.size,
            // The name is a UUID, so the file's own timestamp is the only
            // record of when it arrived.
            uploadedAt: info.mtime,
          };
        } catch {
          // Deleted between the readdir and the stat.
          return null;
        }
      }),
  );

  return found
    .filter((upload): upload is StoredUpload => upload !== null)
    .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
}

/**
 * Removes a photo from disk.
 *
 * The name is pattern-checked before it is joined, exactly as in readUpload, so
 * a crafted name cannot reach out of the upload directory. A file that has
 * already gone counts as success: the caller wanted it absent, and it is.
 */
export async function deleteUpload(name: string): Promise<boolean> {
  if (!FILENAME.test(name)) return false;

  try {
    await unlink(path.join(UPLOAD_DIR, name));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return true;
    console.error(`[upload] could not delete ${name}:`, error);
    return false;
  }

  return true;
}
