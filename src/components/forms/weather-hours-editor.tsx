"use client";

import { Input, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
  const overflow = total > 24;
  const incomplete = total < 24;

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
      <p
        className={cn(
          "text-xs",
          overflow ? "font-medium text-red-600" : incomplete ? "text-amber-600" : "text-emerald-600"
        )}
      >
        Total: {total} / 24 jam
        {overflow && " — melebihi 24 jam, tidak dapat disimpan"}
        {!overflow && incomplete && " — belum lengkap (boleh disimpan)"}
        {!overflow && !incomplete && " — lengkap"}
      </p>
    </div>
  );
}
