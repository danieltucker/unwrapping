import { countDrops, ingestBatch } from "@/lib/tracking";
import { MAX_BODY_BYTES } from "@/lib/event-validation";

/**
 * Where the browser's batched events land; see src/lib/track.ts for the sender
 * and src/lib/tracking.ts for what is stored.
 *
 * Always answers 204 with nothing in it, stored or not. The sender is a beacon
 * that never reads the answer, and telling a script which of its events were
 * refused would only help it find what gets through.
 */
const nothing = () =>
  new Response(null, { status: 204, headers: { "cache-control": "no-store" } });

export async function POST(request: Request) {
  // Refused without reading when the sender says up front it is too big.
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) {
    await countDrops({ too_large: 1 });
    return nothing();
  }

  const body = await readCapped(request, MAX_BODY_BYTES);
  if (body === null) {
    await countDrops({ too_large: 1 });
    return nothing();
  }

  await ingestBatch(body);
  return nothing();
}

/**
 * The body as text, or null once it passes `limit` bytes. Read in chunks, so a
 * body with no Content-Length can't make the server hold more than that.
 */
async function readCapped(request: Request, limit: number): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
