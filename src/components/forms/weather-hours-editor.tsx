"use client";

import { Input, Label } from "@/components/ui/input";
import { parseDecimalInput, roundHours } from "@/lib/utils";

export interface WeatherState {
  weatherHotH: string;
  weatherClearH: string;
  weatherCloudyH: string;
  weatherDrizzleH: string;
  weatherRainH: string;
}

const FIELDS: { key: keyof WeatherState; label: string }[] = [
  { key: "weatherHotH", label: "Sangat Terik (jam)" },
  { key: "weatherClearH", label: "Cerah (jam)" },
  { key: "weatherCloudyH", label: "Mendung (jam)" },
  { key: "weatherDrizzleH", label: "Gerimis (jam)" },
  { key: "weatherRainH", label: "Hujan Deras (jam)" },
];

export function WeatherHoursEditor({
  value,
  onChange,
}: {
  value: WeatherState;
  onChange: (v: WeatherState) => void;
}) {
  const total = roundHours(FIELDS.reduce((sum, f) => sum + parseDecimalInput(value[f.key] || "0"), 0));

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <Label htmlFor={f.key}>{f.label}</Label>
            <Input
              id={f.key}
              type="text"
              inputMode="decimal"
              pattern="[0-9]*[.,]?[0-9]*"
              value={value[f.key]}
              onChange={(e) => {
                const next = e.target.value;
                if (/^[0-9]*[.,]?[0-9]*$/.test(next)) {
                  onChange({ ...value, [f.key]: next });
                }
              }}
              placeholder="0"
            />
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        Total jam tercatat: {total} jam. Isi sesuai kondisi yang benar-benar teramati — tidak
        harus berjumlah 24 jam. Boleh pakai angka koma (mis. 1,5).
      </p>
    </div>
  );
}
