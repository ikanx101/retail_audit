import { prisma } from "@/lib/prisma";
import { normalizeBrandName } from "@/lib/business-rules";

export interface SaleRowInput {
  brandId?: string | null;
  brandName: string;
  sachetsSold: number;
  variantNote?: string | null;
  isNewBrand?: boolean;
}

/**
 * Cocokkan setiap baris penjualan ke master merek (jika ada) tanpa mengubah
 * master list — merek baru tetap tersimpan sebagai snapshot di visit_sales
 * (VL-07, FR-12, bagian 6 "Nama merek disimpan sebagai snapshot").
 */
export async function resolveSaleRows(rows: SaleRowInput[]) {
  const brands = await prisma.brand.findMany();
  const byNormalizedName = new Map(brands.map((b) => [normalizeBrandName(b.name), b]));
  const byId = new Map(brands.map((b) => [b.id, b]));

  return rows.map((row) => {
    let brand = row.brandId ? byId.get(row.brandId) : undefined;
    if (!brand) brand = byNormalizedName.get(normalizeBrandName(row.brandName));

    return {
      brandId: brand?.id ?? null,
      brandNameSnapshot: row.brandName.trim(),
      sachetsSold: row.sachetsSold,
      variantNote: row.variantNote || null,
      isNewBrand: !brand,
    };
  });
}
