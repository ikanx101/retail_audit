import { describe, it, expect } from "vitest";
import { isValidIndonesianPhone, normalizePhone } from "./phone";

describe("VL-03 validasi nomor telepon Indonesia", () => {
  it("menerima format 08xx", () => {
    expect(isValidIndonesianPhone("081234567890")).toBe(true);
  });
  it("menerima format +628xx", () => {
    expect(isValidIndonesianPhone("+6281234567890")).toBe(true);
  });
  it("menolak nomor terlalu pendek", () => {
    expect(isValidIndonesianPhone("0812")).toBe(false);
  });
  it("menolak nomor yang tidak diawali 08/62/+62", () => {
    expect(isValidIndonesianPhone("021234567")).toBe(false);
  });
});

describe("normalisasi nomor telepon", () => {
  it("menormalkan 08xx menjadi +62xx", () => {
    expect(normalizePhone("081234567890")).toBe("+6281234567890");
  });
  it("menormalkan 628xx menjadi +628xx", () => {
    expect(normalizePhone("6281234567890")).toBe("+6281234567890");
  });
  it("mempertahankan +628xx", () => {
    expect(normalizePhone("+6281234567890")).toBe("+6281234567890");
  });
});
