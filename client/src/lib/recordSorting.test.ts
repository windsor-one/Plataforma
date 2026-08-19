import { describe, expect, it } from "vitest";
import { sortRecordsNewest } from "./recordSorting";

describe("orden cronológico de registros", () => {
  it("ordena marcas de tiempo de Firestore y mantiene los registros sin fecha al final", () => {
    const timestamp = (milliseconds: number) => ({ toMillis: () => milliseconds });
    const ordered = sortRecordsNewest([
      { id: "without-date", at: undefined },
      { id: "old", at: timestamp(100) },
      { id: "new", at: timestamp(300) },
    ], item => item.at);
    expect(ordered.map(item => item.id)).toEqual(["new", "old", "without-date"]);
  });
});
