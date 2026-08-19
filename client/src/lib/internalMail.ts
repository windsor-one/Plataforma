import type { InternalMessage } from "./types";
import { sortRecordsNewest } from "./recordSorting";

export type MailFolder = "inbox" | "sent" | "draft" | "scheduled";

export const isSentBy = (message: InternalMessage, userId: string) => message.senderId === userId;
export const isMailUnread = (message: InternalMessage, userId: string) => !isSentBy(message, userId) && message.status === "sent" && !(message.readByIds || []).includes(userId);
export function sortInternalMessagesNewest(messages: InternalMessage[]) {
  return sortRecordsNewest(messages, message => message.createdAt);
}

export function filterInternalMessages(messages: InternalMessage[], folder: MailFolder, userId: string) {
  return messages.filter((message) => folder === "inbox"
    ? !isSentBy(message, userId) && message.status === "sent"
    : folder === "sent"
      ? isSentBy(message, userId) && message.status === "sent"
      : isSentBy(message, userId) && message.status === folder);
}
