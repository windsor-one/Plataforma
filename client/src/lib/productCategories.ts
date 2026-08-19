import type { ProductCategory, ProductCategorySetting } from "./types";

export const defaultProductCategoryLabels: Record<ProductCategory, string> = {
  tariff: "Aranceles",
  promotion: "Promociones SIGES",
};

/** Fusiona la configuración persistida con etiquetas seguras para catálogos sin inicializar. */
export function resolveProductCategoryLabels(settings: ProductCategorySetting[]): Record<ProductCategory, string> {
  return settings.reduce<Record<ProductCategory, string>>((labels, setting) => ({
    ...labels,
    [setting.id]: setting.label.trim() || labels[setting.id],
  }), { ...defaultProductCategoryLabels });
}
