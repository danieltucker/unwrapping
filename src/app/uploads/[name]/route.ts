import { readUpload } from "@/lib/uploads";

/** Serves owner-uploaded gift photos from outside the public directory. */
export async function GET(_request: Request, context: RouteContext<"/uploads/[name]">) {
  const { name } = await context.params;
  const file = await readUpload(name);

  if (!file) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "content-type": file.contentType,
      // Never let a browser second-guess the type we determined from the bytes.
      "x-content-type-options": "nosniff",
      "content-disposition": "inline",
      // The name is content-addressed by a random id, so it never changes.
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
