import { describe, expect, it } from "vitest";
import { getInternalMailStorage, isFirebaseConfigured } from "./firebase";

describe("Firebase opcional para adjuntos internos", () => {
  it("evita inicializar Storage cuando la configuración de Firebase no está disponible", () => {
    if (!isFirebaseConfigured) {
      expect(() => getInternalMailStorage()).toThrow(/adjuntos privados no están disponibles/i);
      return;
    }

    expect(typeof getInternalMailStorage).toBe("function");
  });
});
