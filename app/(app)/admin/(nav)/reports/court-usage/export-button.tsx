"use client";

import { Button } from "@/components/ui/button";

type Row = {
  court_name: string;
  surface: string;
  confirmed_count: number;
  cancelled_count: number;
  hours_reserved: number;
  occupancyPct: number;
};

export function ExportCsvButton({ rows, from, to }: { rows: Row[]; from: string; to: string }) {
  function exportCsv() {
    const header = ["Cancha", "Superficie", "Confirmadas", "Canceladas", "Horas reservadas", "Ocupación %"];
    const lines = rows.map((r) => [
      r.court_name,
      r.surface,
      String(r.confirmed_count),
      String(r.cancelled_count),
      r.hours_reserved.toFixed(1),
      r.occupancyPct.toFixed(1),
    ]);
    const csv = [header, ...lines]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `uso-canchas_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button type="button" variant="secondary" onClick={exportCsv}>
      <span className="material-symbols-outlined text-[18px]" aria-hidden>
        download
      </span>
      Exportar CSV
    </Button>
  );
}
