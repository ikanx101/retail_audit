"use client";

import { Input, Label } from "@/components/ui/input";

export interface WeatherState {
  weatherClearH: string;
  weatherCloudyH: string;
  weatherDrizzleH: string;
  weatherRainH: string;
}

const FIELDS: { key: keyof WeatherState; label: string }[] = [
  { key: "weatherClearH", label: "Cerah (jam)" },
  { key: "weatherCloudyH", label: "Mendung (jam)" },
  { key: "weatherDrizzleH", label: "Gerimis (jam)" },
  { key: "weatherRainH", label: "Hujan (jam)" },
];

export function WeatherHoursEditor({
  value,
  onChange,
}: {
  value: WeatherState;
  onChange: (v: WeatherState) => void;
}) {
  const total = FIELDS.reduce((sum, f) => sum + Number(value[f.key] || 0), 0);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <Label htmlFor={f.key}>{f.label}</Label>
            <Input
              id={f.key}
              type="number"
              inputMode="numeric"
              min={0}
              max={24}
              value={value[f.key]}
              onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
              placeholder="0"
            />
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        Total jam tercatat: {total} jam. Isi sesuai kondisi yang benar-benar teramati — tidak
        harus berjumlah 24 jam.
      </p>
    </div>
  );
}
