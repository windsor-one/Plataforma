import { describe, expect, it } from "vitest";
import { filterInternalMessages, isMailUnread } from "./internalMail";
import type { InternalMessage } from "./types";

const message = (overrides: Partial<InternalMessage>): InternalMessage => ({
  id: "mail-1", senderId: "sender", senderName: "Remitente", senderEmail: "sender@example.com", recipientIds: ["recipient"], participantIds: ["sender", "recipient"], subject: "Asunto", body: "Contenido", status: "sent", readByIds: [], ...overrides,
});

describe("correo interno", () => {
  it("separa correctamente la bandeja de entrada, enviados y borradores", () => {
    const messages = [message({ id: "inbox" }), message({ id: "sent", senderId: "recipient" }), message({ id: "draft", senderId: "recipient", status: "draft" })];
    expect(filterInternalMessages(messages, "inbox", "recipient").map((item) => item.id)).toEqual(["inbox"]);
    expect(filterInternalMessages(messages, "sent", "recipient").map((item) => item.id)).toEqual(["sent"]);
    expect(filterInternalMessages(messages, "draft", "recipient").map((item) => item.id)).toEqual(["draft"]);
  });

  it("solo marca como no leídos los mensajes recibidos y enviados", () => {
    expect(isMailUnread(message(), "recipient")).toBe(true);
    expect(isMailUnread(message({ readByIds: ["recipient"] }), "recipient")).toBe(false);
    expect(isMailUnread(message({ senderId: "recipient" }), "recipient")).toBe(false);
    expect(isMailUnread(message({ status: "draft" }), "recipient")).toBe(false);
  });
});
