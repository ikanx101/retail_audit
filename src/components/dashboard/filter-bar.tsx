"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Interviewer {
  id: string;
  fullName: string;
}

export function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [dateFrom, setDateFrom] = React.useState(searchParams.get("dateFrom") ?? "");
  const [dateTo, setDateTo] = React.useState(searchParams.get("dateTo") ?? "");
  const [interviewerId, setInterviewerId] = React.useState(searchParams.get("interviewerId") ?? "");
  const [q, setQ] = React.useState(searchParams.get("q") ?? "");
  const [brandName, setBrandName] = React.useState(searchParams.get("brandName") ?? "");

  const { data: interviewers } = useQuery({
    queryKey: ["interviewers", "filter-options"],
    queryFn: async (): Promise<Interviewer[]> => {
      const res = await fetch("/api/interviewers");
      const json = await res.json();
      return json.data ?? [];
    },
  });

  const { data: brands } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const res = await fetch("/api/brands");
      const json = await res.json();
      return (json.data ?? []) as { id: string; name: string }[];
    },
  });

  function applyFilters() {
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (interviewerId) params.set("interviewerId", interviewerId);
    if (q) params.set("q", q);
    if (brandName) params.set("brandName", brandName);
    router.push(`${pathname}?${params.toString()}`);
  }

  function resetFilters() {
    setDateFrom("");
    setDateTo("");
    setInterviewerId("");
    setQ("");
    setBrandName("");
    router.push(pathname);
  }

  return (
    <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-6">
      <div>
        <Label htmlFor="f-dateFrom">Dari tanggal</Label>
        <Input id="f-dateFrom" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="f-dateTo">Sampai tanggal</Label>
        <Input id="f-dateTo" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="f-interviewer">Interviewer</Label>
        <Select id="f-interviewer" value={interviewerId} onChange={(e) => setInterviewerId(e.target.value)}>
          <option value="">Semua</option>
          {interviewers?.map((i) => (
            <option key={i.id} value={i.id}>
              {i.fullName}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="f-brand">Merek</Label>
        <Select id="f-brand" value={brandName} onChange={(e) => setBrandName(e.target.value)}>
          <option value="">Semua</option>
          {brands?.map((b) => (
            <option key={b.id} value={b.name}>
              {b.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="f-q">Cari warung</Label>
        <Input id="f-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nama warung..." />
      </div>
      <div className="flex items-end gap-2">
        <Button type="button" onClick={applyFilters} className="flex-1">
          Terapkan
        </Button>
        <Button type="button" variant="outline" onClick={resetFilters}>
          Reset
        </Button>
      </div>
    </div>
  );
}
