"use client";

import * as React from "react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { isSachetsUnusual } from "@/lib/business-rules";

export interface SaleRowState {
  key: string;
  brandId: string | null;
  brandName: string;
  sachetsSold: string; // string di form, di-parse saat submit
  variantNote: string;
}

interface BrandOption {
  id: string;
  name: string;
}

export function SalesRowsEditor({
  rows,
  onChange,
  brandOptions,
}: {
  rows: SaleRowState[];
  onChange: (rows: SaleRowState[]) => void;
  brandOptions: BrandOption[];
}) {
  function updateRow(key: string, patch: Partial<SaleRowState>) {
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow() {
    onChange([
      ...rows,
      { key: crypto.randomUUID(), brandId: null, brandName: "", sachetsSold: "", variantNote: "" },
    ]);
  }

  function removeRow(key: string) {
    onChange(rows.filter((r) => r.key !== key));
  }

  return (
    <div className="space-y-3">
      <datalist id="brand-suggestions">
        {brandOptions.map((b) => (
          <option key={b.id} value={b.name} />
        ))}
      </datalist>

      {rows.map((row, idx) => {
        const sachets = Number(row.sachetsSold || 0);
        const unusual = isSachetsUnusual(sachets);
        const isKnownBrand = brandOptions.some((b) => b.name.toLowerCase() === row.brandName.trim().toLowerCase());

        return (
          <div key={row.key} className="rounded-lg border border-slate-200 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Merek #{idx + 1}</span>
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(row.key)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Hapus
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <Label htmlFor={`brand-${row.key}`}>Nama merek</Label>
                <Input
                  id={`brand-${row.key}`}
                  list="brand-suggestions"
                  value={row.brandName}
                  onChange={(e) => {
                    const name = e.target.value;
                    const matched = brandOptions.find((b) => b.name.toLowerCase() === name.toLowerCase());
                    updateRow(row.key, { brandName: name, brandId: matched?.id ?? null });
                  }}
                  placeholder="mis. Good Day"
                />
                {row.brandName && !isKnownBrand && (
                  <p className="mt-1 text-xs text-blue-600">+ Merek baru akan ditambahkan</p>
                )}
              </div>
              <div>
                <Label htmlFor={`sachets-${row.key}`}>Sachet terjual hari ini</Label>
                <Input
                  id={`sachets-${row.key}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={row.sachetsSold}
                  onChange={(e) => updateRow(row.key, { sachetsSold: e.target.value })}
                  placeholder="0"
                />
                {unusual && (
                  <p className="mt-1 text-xs text-amber-600">Angka cukup besar, pastikan bukan kumulatif.</p>
                )}
              </div>
              <div>
                <Label htmlFor={`variant-${row.key}`}>Catatan (opsional)</Label>
                <Input
                  id={`variant-${row.key}`}
                  value={row.variantNote}
                  onChange={(e) => updateRow(row.key, { variantNote: e.target.value })}
                  placeholder="varian/harga/promo"
                />
              </div>
            </div>
          </div>
        );
      })}

      <Button type="button" variant="outline" size="sm" onClick={addRow}>
        + Tambah merek
      </Button>
    </div>
  );
}
