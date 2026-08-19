import type { InternalMessage } from "./types";
import { sortRecordsNewest } from "./recordSorting";

export type MailFolder = "inbox" | "sent" | "draft" | "scheduled" | "trash";

export const isSentBy = (message: InternalMessage, userId: string) => message.senderId === userId;
export const isMailUnread = (message: InternalMessage, userId: string) => !isSentBy(message, userId) && message.status === "sent" && !(message.readByIds || []).includes(userId);
export const isInTrash = (message: InternalMessage, userId: string) => (message.trashedByIds || []).includes(userId);
export const isDeletedFor = (message: InternalMessage, userId: string) => (message.deletedByIds || []).includes(userId);

export function sortInternalMessagesNewest(messages: InternalMessage[]) {
  return sortRecordsNewest(messages, message => message.createdAt);
}

export function filterInternalMessages(messages: InternalMessage[], folder: MailFolder, userId: string) {
  return messages.filter((message) => {
    if (isDeletedFor(message, userId)) return false;
    if (folder === "trash") return isInTrash(message, userId);
    if (isInTrash(message, userId)) return false;
    return folder === "inbox"
      ? !isSentBy(message, userId) && message.status === "sent"
      : folder === "sent"
        ? isSentBy(message, userId) && message.status === "sent"
        : isSentBy(message, userId) && message.status === folder;
  });
}
