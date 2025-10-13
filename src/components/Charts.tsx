// src/components/Charts.tsx
import React, { useState, useMemo, useRef } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  ChartEvent,
  ActiveElement,
} from "chart.js";
import { Bar, Pie } from "react-chartjs-2";
import {
  addDays,
  addMonths,
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfYear,
  endOfYear,
} from "date-fns";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

type Entry = { id: string; day: string; label: string; minutes: number };
type LabelRow = { id: string; name: string; color_hex: string | null };

const toHours = (mins: number) => +(mins / 60).toFixed(2);

export default function Charts() {
  const today = new Date();

  // label colors
  const { data: labels = [] } = useSWR<LabelRow[]>("/api/labels", api);
  const colorFor = (name: string) =>
    labels.find((l) => l.name === name)?.color_hex || "#FFD7E2";

  // ───────────────────────────────────────────────────────────────
  // DAILY (7-day window, inclusive)
  // ───────────────────────────────────────────────────────────────
  const [dailyOffsetDays, setDailyOffsetDays] = useState(0); // 0..365
  const dailyEnd = addDays(today, dailyOffsetDays);
  const dailyStart = addDays(dailyEnd, -6);

  const dailyKey = `/api/entries?from=${format(dailyStart, "yyyy-MM-dd")}&to=${format(dailyEnd, "yyyy-MM-dd")}`;
  const { data: daily = [] } = useSWR<Entry[]>(dailyKey, api);

  const dailyMap = new Map<string, number>();
  daily.forEach((e) => dailyMap.set(e.day, (dailyMap.get(e.day) || 0) + e.minutes));

  const dailyDays = eachDayOfInterval({ start: dailyStart, end: dailyEnd });
  const dailyLabels = dailyDays.map((d) => format(d, "MMM d"));
  const dailyData = dailyDays.map((d) => toHours(dailyMap.get(format(d, "yyyy-MM-dd")) || 0));

  // ───────────────────────────────────────────────────────────────
  // MONTHLY (13 stacked bars starting this month; stacked by label)
  // ───────────────────────────────────────────────────────────────
  const months = useMemo(
    () => Array.from({ length: 13 }, (_, i) => startOfMonth(addMonths(today, i))),
    [today]
  );
  const monthShorts = months.map((m) => format(m, "LLL")); // Oct, Nov, ...
  const windowFrom = months[0];
  const windowTo = endOfMonth(addMonths(today, 12)); // ← exactly 13 months inclusive

  const winKey = `/api/entries?from=${format(windowFrom, "yyyy-MM-dd")}&to=${format(windowTo, "yyyy-MM-dd")}`;
  const { data: winEntries = [] } = useSWR<Entry[]>(winKey, api);

  const labelNames = useMemo(() => {
    const s = new Set<string>();
    winEntries.forEach((e) => s.add(e.label));
    return Array.from(s);
  }, [winEntries]);

  const stackedDatasets = useMemo(() => {
    const base = months[0];
    const baseMonth = base.getMonth();
    const baseYear = base.getFullYear();

    const acc: Record<string, number[]> = {};
    labelNames.forEach((l) => (acc[l] = new Array(13).fill(0)));

    winEntries.forEach((e) => {
      const d = new Date(e.day);
      const offset = (d.getFullYear() - baseYear) * 13 + (d.getMonth() - baseMonth);
      if (offset >= 0 && offset < 13) acc[e.label][offset] += e.minutes;
    });

    return labelNames.map((name) => ({
      label: name,
      data: acc[name].map(toHours),
      backgroundColor: colorFor(name),
      borderWidth: 0,
      stack: "months",
      barPercentage: 0.65,
      categoryPercentage: 0.65,
      maxBarThickness: 26,
    }));
  }, [winEntries, labelNames, months]);

  const yearCaption = (() => {
    const firstY = months[0].getFullYear();
    const lastY = months[months.length - 1].getFullYear();
    return firstY === lastY ? String(firstY) : `${firstY} — ${lastY}`;
  })();

  // ───────────────────────────────────────────────────────────────
  // TASK BREAKDOWN (current month totals by label)
  // ───────────────────────────────────────────────────────────────
  const mStart = startOfMonth(today);
  const mEnd = endOfMonth(today);
  const monthKey = `/api/entries?from=${format(mStart, "yyyy-MM-dd")}&to=${format(mEnd, "yyyy-MM-dd")}`;
  const { data: monthEntries = [] } = useSWR<Entry[]>(monthKey, api);

  const byLabelMonth = new Map<string, number>();
  monthEntries.forEach((e) =>
    byLabelMonth.set(e.label, (byLabelMonth.get(e.label) || 0) + e.minutes)
  );
  const tbLabels = Array.from(byLabelMonth.keys());
  const tbData = tbLabels.map((l) => toHours(byLabelMonth.get(l) || 0));
  const tbColors = tbLabels.map(colorFor);

  // ───────────────────────────────────────────────────────────────
  // OVERVIEW (pie, YTD totals by label)
  // ───────────────────────────────────────────────────────────────
  const yStart = startOfYear(today);
  const yEnd = endOfYear(today);
  const yearKey = `/api/entries?from=${format(yStart, "yyyy-MM-dd")}&to=${format(yEnd, "yyyy-MM-dd")}`;
  const { data: yearEntries = [] } = useSWR<Entry[]>(yearKey, api);

  const byLabelYear = new Map<string, number>();
  yearEntries.forEach((e) =>
    byLabelYear.set(e.label, (byLabelYear.get(e.label) || 0) + e.minutes)
  );
  const overviewLabels = Array.from(byLabelYear.keys());
  const overviewData = overviewLabels.map((l) => toHours(byLabelYear.get(l) || 0));
  const overviewColors = overviewLabels.map(colorFor);

  // click-to-select states + refs
  const [dailySelected, setDailySelected] = useState<string | null>(null);
  const [monthlySelected, setMonthlySelected] = useState<string | null>(null);
  const [tbSelected, setTbSelected] = useState<string | null>(null);

  const dailyRef = useRef<any>(null);
  const monthlyRef = useRef<any>(null);
  const tbRef = useRef<any>(null);

  const fmtH = (n: number) => `${n.toFixed(2)} h`;

  return (
    <div>
      {/* DAILY */}
      <div className="section card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2>𝓓𝓪𝓲𝓵𝔂</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <small>
              {format(dailyStart, "dd/MM")} → {format(dailyEnd, "dd/MM")}
            </small>
            <input
              type="range"
              min={0}
              max={365}
              value={dailyOffsetDays}
              onChange={(e) => setDailyOffsetDays(parseInt(e.target.value, 10))}
              style={{ width: 180 }}
              aria-label="Shift daily window"
            />
            <button
              onClick={() => setDailyOffsetDays(0)}
              style={{ border: "none", background: "transparent", textDecoration: "underline", fontSize: 12, cursor: "pointer" }}
              aria-label="Reset to today"
            >
              Reset
            </button>
          </div>
        </div>

        <div style={{ position: "relative", height: 360 }}>
          <Bar
            ref={dailyRef}
            data={{
              labels: dailyLabels,
              datasets: [{ label: "Hours", data: dailyData, backgroundColor: "#FFD7E2" }],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: { min: 0, max: 16, ticks: { stepSize: 2, callback: (v) => `${v}h` } },
              },
              plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (ctx) => `${ctx.formattedValue} h` } },
              },
              onClick: (_evt: ChartEvent, els: ActiveElement[]) => {
                if (!els.length) { setDailySelected(null); return; }
                const { index } = els[0];
                const label = dailyLabels[index];
                const val = dailyData[index] ?? 0;
                setDailySelected(`${la
