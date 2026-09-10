import { describe, it, expect } from "vitest";
import {
  totalWeatherHours,
  isSachetsUnusual,
  isTotalSachetsLarge,
  isVisitTimeUnusual,
  isVisitDateValid,
  isDateTooFarInPast,
  normalizeBrandName,
  hasDuplicateBrands,
  isGpsAccuracyPoor,
  isWithinIndonesiaBBox,
} from "./business-rules";

describe("Jam cuaca (sejak v1.5: tidak wajib berjumlah 24 jam)", () => {
  it("totalWeatherHours menjumlahkan seluruh kondisi apa adanya, tanpa batas 24 jam", () => {
    expect(totalWeatherHours({ clear: 5, cloudy: 2, drizzle: 0, rain: 0 })).toBe(7);
    expect(totalWeatherHours({ clear: 12, cloudy: 6, drizzle: 3, rain: 3 })).toBe(24);
  });
});

describe("VL-02 sachet tidak wajar", () => {
  it("> 5000 sachet per merek memicu peringatan", () => {
    expect(isSachetsUnusual(5001)).toBe(true);
    expect(isSachetsUnusual(5000)).toBe(false);
  });
});

describe("FR-45 total sachet harian besar", () => {
  it("> 500 total sachet dalam satu kunjungan memicu konfirmasi", () => {
    expect(isTotalSachetsLarge([{ sachets: 300 }, { sachets: 201 }])).toBe(true);
    expect(isTotalSachetsLarge([{ sachets: 300 }, { sachets: 200 }])).toBe(false);
  });
});

describe("VL-11 jam kunjungan tidak wajar", () => {
  it("sebelum 04:00 dianggap tidak wajar", () => {
    expect(isVisitTimeUnusual("03:59")).toBe(true);
  });
  it("setelah/pada 23:00 dianggap tidak wajar", () => {
    expect(isVisitTimeUnusual("23:00")).toBe(true);
  });
  it("10:30 dianggap wajar", () => {
    expect(isVisitTimeUnusual("10:30")).toBe(false);
  });
});

describe("VL-05 rentang tanggal kunjungan", () => {
  const today = "2026-09-10";
  it("tanggal di masa depan tidak valid", () => {
    expect(isVisitDateValid("2026-09-11", today)).toBe(false);
  });
  it("tanggal sebelum 2026-01-01 tidak valid", () => {
    expect(isVisitDateValid("2025-12-31", today)).toBe(false);
  });
  it("tanggal hari ini valid", () => {
    expect(isVisitDateValid(today, today)).toBe(true);
  });
});

describe("FR-16 tanggal terlalu jauh ke belakang (peringatan lunak)", () => {
  it("> 30 hari ke belakang memicu peringatan", () => {
    expect(isDateTooFarInPast("2026-08-01", "2026-09-10")).toBe(true);
  });
  it("<= 30 hari ke belakang tidak memicu peringatan", () => {
    expect(isDateTooFarInPast("2026-08-15", "2026-09-10")).toBe(false);
  });
});

describe("VL-07 duplikasi merek", () => {
  it("mendeteksi duplikat case-insensitive & trim", () => {
    expect(hasDuplicateBrands(["Good Day", " good day ", "Nutrisari"])).toBe(true);
  });
  it("tidak ada duplikat pada daftar berbeda", () => {
    expect(hasDuplicateBrands(["Good Day", "Nutrisari"])).toBe(false);
  });
  it("normalizeBrandName menghilangkan spasi berlebih & mengubah ke lowercase", () => {
    expect(normalizeBrandName("  Good   Day ")).toBe("good day");
  });
});

describe("FR-14 akurasi GPS", () => {
  it("> 50 meter dianggap buruk", () => {
    expect(isGpsAccuracyPoor(51)).toBe(true);
    expect(isGpsAccuracyPoor(50)).toBe(false);
    expect(isGpsAccuracyPoor(null)).toBe(false);
  });
});

describe("VL-04 bounding box Indonesia", () => {
  it("koordinat Jakarta berada dalam bounding box", () => {
    expect(isWithinIndonesiaBBox(-6.2, 106.8)).toBe(true);
  });
  it("koordinat di luar Indonesia terdeteksi", () => {
    expect(isWithinIndonesiaBBox(40.7, -74.0)).toBe(false);
  });
});
