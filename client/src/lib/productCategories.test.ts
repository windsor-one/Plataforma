import { describe, expect, it } from "vitest";
import { defaultProductCategoryLabels, resolveProductCategoryLabels } from "./productCategories";

describe("resolveProductCategoryLabels", () => {
  it("mantiene nombres predeterminados cuando la configuración aún no existe", () => {
    expect(resolveProductCategoryLabels([])).toEqual(defaultProductCategoryLabels);
  });

  it("sobrescribe únicamente la categoría configurada y descarta etiquetas vacías", () => {
    expect(resolveProductCategoryLabels([{ id: "promotion", label: "Campaña de graduación" }, { id: "tariff", label: "  " }])).toEqual({
      tariff: "Aranceles",
      promotion: "Campaña de graduación",
    });
  });
});
