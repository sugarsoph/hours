import React, { useState, useMemo } from "react";
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

const HOUR = (mins: number) => +(mins / 60).toFixed(2);

export default function Charts() {
  const today = new Date();

  // Labels (for colors)
  const { data: labels = [] } = useSWR<LabelRow[]>("/api/labels", api);
  const colorFor = (name: string) =>
    labels.find((l) => l.name === name)?.color_hex || "#FFD7E2";

  // DAILY (7-day window, slider forward only)
  const [dailyOffsetDays, setDailyOffsetDays] = useState(0); // 0..365
  const dailyEnd = addDays(today, dailyOffsetDays);
  const dailyStart = addDays(dailyEnd, -6);

  const { data: daily = [] } = useSWR<Entry[]>(
    `/api/entries?from=${format(dailyStart, "yyyy-MM-dd")}&to=${format(dailyEnd, "yyyy-MM-dd")}`,
    api
  );

  const dailyMap = new Map<string, number>();
  daily.forEach((e) => dailyMap.set(e.day, (dailyMap.get(e.day) || 0) + e.minutes));
  const dailyDays = eachDayOfInterval({ start: dailyStart, end: dailyEnd });
  const dailyLabels = dailyDays.map((d) => format(d, "MMM d"));
  const dailyData = dailyDays.map((d) => HOUR(dailyMap.get(format(d, "yyyy-MM-dd")) || 0));

  // MONTHLY (12 stacked bars, current month → next 11 months; stacked by label color)
  const monthsWindow = useMemo(
    () => Array.from({ length: 12 }, (_, i) => startOfMonth(addMonths(today, i))),
    [today]
  );
  const monthsLabels = monthsWindow.map((m) => format(m, "LLL")); // Oct, Nov, ...
  const monthsStart = monthsWindow[0];
  const monthsEnd = endOfMonth(addMonths(today, 11));

  const { data: windowEntries = [] } = useSWR<Entry[]>(
    `/api/entries?from=${format(monthsStart, "yyyy-MM-dd")}&to=${format(monthsEnd, "yyyy-MM-dd")}`,
    api
  );

  // Which labels appear in the 12-month window
  const labelNames = useMemo(() => {
    const s = new Set<string>();
    windowEntries.forEach((e) => s.add(e.label));
    return Array.from(s);
  }, [windowEntries]);

  // Build stacked datasets (hours per month per label)
  const stackedDatasets = useMemo(() => {
    const base = monthsWindow[0];
    const baseMonth = base.getMonth();
    const baseYear = base.getFullYear();

    const acc: Record<string, number[]> = {};
    labelNames.forEach((l) => (acc[l] = new Array(12).fill(0)));

    windowEntries.forEach((e) => {
      const d = new Date(e.day);
      const offset = (d.getFullYear() - baseYear) * 12 + (d.getMonth() - baseMonth);
      if (offset >= 0 && offset < 12) acc[e.label][offset] += e.minutes;
    });

    return labelNames.map((name) => ({
      label: name,
      data: acc[name].map(HOUR),
      backgroundColor: colorFor(name),
      borderWidth: 0,
      stack: "months",
      // keep bars modest so it never looks huge
      barPercentage: 0.7,
      categoryPercentage: 0.7,
      maxBarThickness: 28,
    }));
  }, [windowEntries, labelNames, monthsWindow]);

  // Caption like "2025 — 2026"
  const yearCaption = (() => {
    const firstY = monthsWindow[0].getFullYear();
    const lastY = monthsWindow[monthsWindow.length - 1].getFullYear();
    return firstY === lastY ? String(firstY) : `${firstY} — ${lastY}`;
  })();

  // TASK BREAKDOWN (current month totals by label, horizontal)
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const { data: monthEntries = [] } = useSWR<Entry[]>(
    `/api/entries?from=${format(monthStart, "yyyy-MM-dd")}&to=${format(monthEnd, "yyyy-MM-dd")}`,
    api
  );
  const byLabelMonth = new Map<string, number>();
  monthEntries.forEach((e) => byLabelMonth.set(e.label, (byLabelMonth.get(e.label) || 0) + e.minutes));
  const tbLabels = Array.from(byLabelMonth.keys());
  const tbData = tbLabels.map((l) => HOUR(byLabelMonth.get(l) || 0));
  const tbColors = tbLabels.map(colorFor);

  // OVERVIEW PIE (year-to-date totals by label)
  const yStart = startOfYear(today);
  const yEnd = endOfYear(today);
  const { data: yearEntries = [] } = useSWR<Entry[]>(
    `/api/entries?from=${format(yStart, "yyyy-MM-dd")}&to=${format(yEnd, "yyyy-MM-dd")}`,
    api
  );
  const byLabelYear = new Map<string, number>();
  yearEntries.forEach((e) => byLabelYear.set(e.label, (byLabelYear.get(e.label) || 0) + e.minutes));
  const overviewLabels = Array.from(byLabelYear.keys());
  const overviewData = overviewLabels.map((l) => HOUR(byLabelYear.get(l) || 0));
  const overviewColors = overviewLabels.map(colorFor);

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

        <Bar
          data={{
            labels: dailyLabels,
            datasets: [{ label: "Hours", data: dailyData, backgroundColor: "#FFD7E2" }],
          }}
          options={{
            // keep default aspect ratio so it doesn't get tall
            scales: {
              y: { min: 0, max: 16, ticks: { stepSize: 2, callback: (v) => `${v}h` } },
            },
            plugins: {
              tooltip: { callbacks: { label: (ctx) => `${ctx.formattedValue} h` } },
            },
          }}
        />
      </div>

      {/* MONTHLY (12 stacked bars; normal size; 0–200 with step 10) */}
      <div className="section card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 className="plain-title">𝓜𝓸𝓷𝓽𝓱𝓵𝔂</h2>
          <small>{yearCaption}</small>
        </div>

        <Bar
          data={{
            labels: monthsLabels,
            datasets: stackedDatasets,
          }}
          options={{
            // keep default aspect ratio (no big height)
            scales: {
              x: {
                stacked: true,
                grid: { display: true, lineWidth: 0.3 },
                ticks: { autoSkip: false }, // show all 12 month labels
              },
              y: {
                stacked: true,
                beginAtZero: true,
                min: 0,
                max: 200,
                ticks: { stepSize: 10, callback: (v) => `${v}h` }, // ⬅️ steps of 10
                grid: { lineWidth: 0.3 },
              },
            },
            plugins: {
              legend: { position: "bottom" },
              tooltip: {
                callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.formattedValue} h` },
              },
            },
          }}
        />
      </div>

      {/* TASK BREAKDOWN (current month) */}
      <div className="section card">
        <h2>𝐵𝓇𝑒𝒶𝓀𝒹𝑜𝓌𝓃  𝐵𝓎  𝒯𝒶𝓈𝓀</h2>
        <Bar
          data={{
            labels: tbLabels,
            datasets: [
              {
                label: "Hours",
                data: tbData,
                backgroundColor: tbColors.length ? tbColors : "#FFD7E2",
              },
            ],
          }}
          options={{
            indexAxis: "y" as const,
            scales: {
              x: {
                beginAtZero: true,
                min: 0,
                max: 200,
                ticks: { stepSize: 10, callback: (v) => `${v}h` },
                grid: { lineWidth: 0.3 },
              },
            },
            plugins: {
              tooltip: { callbacks: { label: (ctx) => `${ctx.formattedValue} h` } },
              legend: { display: false },
            },
          }}
        />
      </div>

      {/* OVERVIEW (pie, year-to-date) */}
      <div className="section card">
        <h2>𝒪𝓋𝑒𝓇𝓋𝒾𝑒𝔀</h2>
        <Pie
          data={{
            labels: overviewLabels,
            datasets: [
              {
                data: overviewData,
                backgroundColor: overviewColors.length ? overviewColors : ["#FFD7E2"],
                borderWidth: 0,
              },
            ],
          }}
          options={{
            plugins: {
              legend: { position: "bottom" },
              tooltip: {
                callbacks: {
                  label: (ctx) => {
                    const label = ctx.label || "";
                    const val = ctx.parsed as number;
                    return `${label}: ${val} h`;
                  },
                },
              },
            },
          }}
        />
      </div>
    </div>
  );
}
