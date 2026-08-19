import type { InternalMessage } from "./types";

export type MailFolder = "inbox" | "sent" | "draft" | "scheduled";

export const isSentBy = (message: InternalMessage, userId: string) => message.senderId === userId;
export const isMailUnread = (message: InternalMessage, userId: string) => !isSentBy(message, userId) && message.status === "sent" && !(message.readByIds || []).includes(userId);

export function filterInternalMessages(messages: InternalMessage[], folder: MailFolder, userId: string) {
  return messages.filter((message) => folder === "inbox"
    ? !isSentBy(message, userId) && message.status === "sent"
    : folder === "sent"
      ? isSentBy(message, userId) && message.status === "sent"
      : isSentBy(message, userId) && message.status === folder);
}
