"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";

/**
 * Native <input type="time"> mengikuti locale/OS browser untuk formatnya — bisa tampil AM/PM
 * meskipun nilai yang disimpan tetap "HH:mm" 24 jam, membingungkan interviewer. Field ini
 * selalu berupa teks biasa: ketik 4 digit (mis. "1430") otomatis menjadi "14:30", tidak
 * pernah menampilkan AM/PM.
 */
export function formatTimeInput(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "").slice(0, 4);
  if (digits.length >= 3) return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  return digits;
}

export const TimeInput24 = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
    value: string;
    onChange: (value: string) => void;
  }
>(function TimeInput24({ value, onChange, ...props }, ref) {
  return (
    <Input
      {...props}
      ref={ref}
      type="text"
      inputMode="numeric"
      placeholder="08:00"
      maxLength={5}
      value={value}
      onChange={(e) => onChange(formatTimeInput(e.target.value))}
    />
  );
});
