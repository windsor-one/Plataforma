import { deleteObject, getBlob, ref, uploadBytes } from "firebase/storage";
import { storage } from "./firebase";
import type { InternalAttachment } from "./types";

const safeFilename = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "archivo";

export async function uploadInternalMailAttachment(messageId: string, file: File): Promise<InternalAttachment> {
  const id = crypto.randomUUID();
  const storagePath = `internalMessages/${messageId}/${id}-${safeFilename(file.name)}`;
  await uploadBytes(ref(storage, storagePath), file, { contentType: file.type || "application/octet-stream" });
  return { id, name: file.name, type: file.type || "application/octet-stream", size: file.size, storagePath };
}

export async function downloadInternalMailAttachment(attachment: InternalAttachment) {
  const blob = await getBlob(ref(storage, attachment.storagePath));
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = attachment.name;
  link.click();
  URL.revokeObjectURL(url);
}

export async function removeInternalMailAttachment(attachment: InternalAttachment) {
  await deleteObject(ref(storage, attachment.storagePath));
}
