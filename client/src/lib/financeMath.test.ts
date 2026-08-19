import { describe, expect, it } from "vitest";
import { subtractCurrencyTotals, totalsByCurrency } from "./financeMath";

describe("cálculos financieros por moneda", () => {
  it("mantiene separadas las monedas al agregar ingresos o gastos", () => {
    expect(totalsByCurrency([
      { amount: 10, currency: "USD" },
      { amount: 5, currency: "USD" },
      { amount: 100, currency: "MXN" },
    ])).toEqual({ USD: 15, MXN: 100 });
  });

  it("calcula flujo por moneda sin aplicar conversiones implícitas", () => {
    expect(subtractCurrencyTotals({ USD: 100, MXN: 500 }, { USD: 25, EUR: 10 })).toEqual({ USD: 75, MXN: 500, EUR: -10 });
  });
});
