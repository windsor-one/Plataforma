import { describe, expect, it } from "vitest";
import { derivedPaymentKind, derivedPaymentStatus, settlementBalance, settlementOverpayment, settlementStatus } from "./paymentMath";

describe("paymentMath", () => {
  it("mantiene pendiente una reserva después de un pago parcial", () => {
    expect(settlementStatus(100, 0, 50)).toBe("pending");
    expect(settlementBalance(100, 0, 50)).toBe(50);
    expect(derivedPaymentKind(100, 0, 50)).toBe("partial");
  });

  it("marca liquidación exacta solo cuando el acumulado alcanza el total", () => {
    expect(settlementStatus(100, 50, 50)).toBe("settled");
    expect(settlementBalance(100, 50, 50)).toBe(0);
    expect(derivedPaymentKind(100, 50, 50)).toBe("balance");
  });

  it("detecta sobrepago y evita pagar cuotas de importe cero", () => {
    expect(settlementStatus(100, 90, 20)).toBe("overpaid");
    expect(settlementOverpayment(100, 90, 20)).toBe(10);
    expect(derivedPaymentStatus(0, "paid")).toBe("pending");
  });
});
