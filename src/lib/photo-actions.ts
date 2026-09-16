"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { items } from "@/db/schema";
import { requireOwnedList } from "@/lib/list-access";
import * as routes from "@/lib/routes";
import { saveUpload } from "@/lib/uploads";

export type UploadState = { url?: string; error?: string };

/**
 * Stores a photo the owner chose from their own device.
 *
 * With an itemId the photo is attached to that gift; without one (during the
 * add flow, before the gift exists) the URL is handed back for the form to
 * carry. Only a list's owner may upload to it.
 */
export async function uploadPhoto(
  _previous: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const handle = String(formData.get("handle") ?? "");
  const key = String(formData.get("key") ?? "");
  const itemId = String(formData.get("itemId") ?? "");

  // Uploading writes to disk, so prove ownership before accepting a byte.
  const { list, ownerHandle } = await requireOwnedList(handle, key);

  const file = formData.get("photo");
  if (!(file instanceof File)) return { error: "Choose an image first." };

  const result = await saveUpload(file);
  if ("error" in result) return result;

  if (itemId) {
    const item = await db
      .select()
      .from(items)
      .where(and(eq(items.id, itemId), eq(items.listId, list.id)))
      .get();

    if (!item) return { error: "That gift is no longer on the list." };

    const images = [...item.images, result.url];
    await db
      .update(items)
      .set({
        images,
        // Show what they just chose.
        selectedImageIndex: images.length - 1,
        needsAttention: null,
      })
      .where(eq(items.id, itemId));

    revalidatePath(routes.editGift(list, ownerHandle, itemId));
    revalidatePath(routes.manageList(list, ownerHandle));
    revalidatePath(routes.publicList(list, ownerHandle));
  }

  return { url: result.url };
}
