import { describe, expect, it } from "vitest";
import { normalizeUpdateRequest } from "./updateRequests";

describe("normalizeUpdateRequest", () => {
  it("provides safe arrays for legacy requests", () => {
    const request = normalizeUpdateRequest({ id: "legacy-1", module: "products", status: "pending" });

    expect(request.allowedActions).toEqual(["edit"]);
    expect(request.fields).toEqual([]);
    expect(() => request.allowedActions.map((action) => action)).not.toThrow();
    expect(() => request.fields.join(", ")).not.toThrow();
  });

  it("filters invalid actions and preserves valid request data", () => {
    const request = normalizeUpdateRequest({
      id: "request-2",
      targetUserName: "Ana",
      module: "customers",
      scope: "record",
      allowedActions: ["edit", "invalid", "delete"],
      fields: "nombre, teléfono",
      status: "completed",
    });

    expect(request.targetUserName).toBe("Ana");
    expect(request.module).toBe("customers");
    expect(request.allowedActions).toEqual(["edit", "delete"]);
    expect(request.fields).toEqual(["nombre", "teléfono"]);
    expect(request.status).toBe("completed");
  });

  it("falls back safely when a document is not an object", () => {
    const request = normalizeUpdateRequest(undefined, "missing-document");

    expect(request.id).toBe("missing-document");
    expect(request.module).toBe("other");
    expect(request.scope).toBe("module");
    expect(request.allowedActions).toEqual(["edit"]);
    expect(request.fields).toEqual([]);
  });
});
