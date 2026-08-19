import { describe, expect, it } from "vitest";
import { defaultProducts, normalizeProduct, resolveProducts } from "./products";

describe("product normalization", () => {
  it("preserves the base details when a remote override is incomplete", () => {
    const base = defaultProducts.find((product) => product.id === "basic")!;
    const [product] = resolveProducts([{ id: "basic", name: "Básico actualizado", active: true } as never]);

    expect(product.name).toBe("Básico actualizado");
    expect(product.details).toEqual(base.details);
    expect(Array.isArray(product.details)).toBe(true);
  });

  it("normalizes malformed details without throwing", () => {
    const product = normalizeProduct({
      id: "custom",
      name: "Paquete personalizado",
      category: "tariff",
      price: 12,
      unit: "por persona",
      tagline: "Disponible",
      active: true,
      details: undefined,
    });

    expect(product.details).toEqual([]);
    expect(() => product.details.map((detail) => detail.label)).not.toThrow();
  });

  it("filters inactive products after normalizing remote records", () => {
    const catalog = resolveProducts([
      { id: "inactive-custom", name: "Oculto", category: "tariff", active: false } as never,
      { id: "active-custom", name: "Visible", category: "promotion", active: true } as never,
    ]);

    expect(catalog.some((product) => product.id === "inactive-custom")).toBe(false);
    expect(catalog.find((product) => product.id === "active-custom")?.details).toEqual([]);
  });
});
