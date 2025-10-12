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

function hours(n: number) {
  return +(n / 60).toFixed(2);
}

export default function Charts() {
  const today = new Date();

  // ──────────────────────────────────────────────────────────────────────────────
  // LABELS (for colors)
  const { data: labels = [] } = useSWR<LabelRow[]>("/api/labels", api);
  const labelColor = (name: string) =>
    labels.find((l) => l.name === name)?.color_hex || "#FFD7E2";

  // ──────────────────────────────────────────────────────────────────────────────
  // DAILY (7-day window; slider only forward)
  const [dailyOffsetDays, setDailyOffsetDays] = useState<number>(0); // 0..365

  const dailyEnd = addDays(today, dailyOffsetDays);
  const dailyStart = addDays(dailyEnd, -6);

  const { data: daily = [] } = useSWR<Entry[]>(
    `/api/entries?from=${format(dailyStart, "yyyy-MM-dd")}&to=${format(
      dailyEnd,
      "yyyy-MM-dd"
    )}`,
    api
  );

  const dailyMap = new Map<string, number>();
  daily.forEach((e) => {
    dailyMap.set(e.day, (dailyMap.get(e.day) || 0) + e.minutes);
  });

  const dailyDays = eachDayOfInterval({ start: dailyStart, end: dailyEnd });
  const dailyLabels = dailyDays.map((d) => format(d, "MMM d"));
  const dailyData = dailyDays.map((d) =>
    hours(dailyMap.get(format(d, "yyyy-MM-dd")) || 0)
  );

  // ──────────────────────────────────────────────────────────────────────────────
  // MONTHLY (12 stacked bars by month, each bar stacked by label)
  // Window: current month → next 11 months
  const monthsWindow = useMemo(
    () => Array.from({ length: 12 }, (_, i) => startOfMonth(addMonths(today, i))),
    [today]
  );
  const monthsLabels = monthsWindow.map((m) => format(m, "LLL")); // Oct, Nov, ...
  const monthsStart = monthsWindow[0];
  const monthsEnd = endOfMonth(addMonths(today, 11));

  // Fetch entries for the whole 12-month window
  const { data: windowEntries = [] } = useSWR<Entry[]>(
    `/api/entries?from=${format(monthsStart, "yyyy-MM-dd")}&to=${format(
      monthsEnd,
      "yyyy-MM-dd"
    )}`,
    api
  );

  // Build list of labels that appear within the window (so the stack includes all)
  const windowLabelSet = useMemo(() => {
    const s = new Set<string>();
    windowEntries.forEach((e) => s.add(e.label));
    return Array.from(s);
  }, [windowEntries]);

  // For each label, compute an array of 12 monthly totals (in hours)
  const stackedDatasets = useMemo(() => {
    // Precompute month index for each entry (0..11 relative to monthsWindow[0])
    const baseMonth = monthsWindow[0].getMonth();
    const baseYear = monthsWindow[0].getFullYear();

    // map: label -> number[12] minutes
    const acc: Record<string, number[]> = {};
    windowLabelSet.forEach((l) => (acc[l] = new Array(12).fill(0)));

    windowEntries.forEach((e) => {
      const d = new Date(e.day);
      // compute offset months between base and this date
      const offset =
        (d.getFullYear() - baseYear) * 12 + (d.getMonth() - baseMonth);
      if (offset >= 0 && offset < 12) {
        const arr = acc[e.label];
        if (arr) arr[offset] += e.minutes;
      }
    });

    // Convert to Chart.js datasets (hours + color)
    return windowLabelSet.map((labelName) => ({
      label: labelName,
      data: acc[labelName].map((min) => hours(min)),
      backgroundColor: labelColor(labelName),
      borderWidth: 0,
      stack: "months", // ensures stacking
    }));
  }, [windowEntries, windowLabelSet, monthsWindow, labelColor]);

  // Show year range caption, e.g., "2025 — 2026"
  const yearCaption = (() => {
    const firstY = monthsWindow[0].getFullYear();
    const lastY = monthsWindow[monthsWindow.length - 1].getFullYear();
    return firstY === lastY ? String(firstY) : `${firstY} — ${lastY}`;
  })();

  // ──────────────────────────────────────────────────────────────────────────────
  // TASK BREAKDOWN (current month totals by label, horizontal)
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  const { data: monthEntries = [] } = useSWR<Entry[]>(
    `/api/entries?from=${format(monthStart, "yyyy-MM-dd")}&to=${format(
      monthEnd,
      "yyyy-MM-dd"
    )}`,
    api
  );

  const byLabelMonth = new Map<string, number>();
  monthEntries.forEach((e) => {
    byLabelMonth.set(e.label, (byLabelMonth.get(e.label) || 0) + e.minutes);
  });
  const tbLabels = Array.from(byLabelMonth.keys());
  const tbData = tbLabels.map((l) => hours(byLabelMonth.get(l) || 0));
  const tbColors = tbLabels.map((l) => labelColor(l));

  // ──────────────────────────────────────────────────────────────────────────────
  // OVERVIEW PIE (year-to-date totals by label)
  const yStart = startOfYear(today);
  const yEnd = endOfYear(today);
  const { data: yearEntries = [] } = useSWR<Entry[]>(
    `/api/entries?from=${format(yStart, "yyyy-MM-dd")}&to=${format(
      yEnd,
      "yyyy-MM-dd"
    )}`,
    api
  );

  const byLabelYear = new Map<string, number>();
  yearEntries.forEach((e) => {
    byLabelYear.set(e.label, (byLabelYear.get(e.label) || 0) + e.minutes);
  });
  const overviewLabels = Array.from(byLabelYear.keys());
  const overviewData = overviewLabels.map((l) => hours(byLabelYear.get(l) || 0));
  const overviewColors = overviewLabels.map((l) => labelColor(l));

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
            scales: {
              y: { min: 0, max: 16, ticks: { callback: (v) => `${v}h` } }, // ⬅️ max 16
            },
            plugins: {
              tooltip: { callbacks: { label: (ctx) => `${ctx.formattedValue} h` } },
            },
          }}
        />
      </div>

      {/* MONTHLY (12 stacked bars) */}
      <div className="section card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 className="plain-title">𝓜𝓸𝓷𝓽𝓱𝓵𝔂</h2>
          <small>{yearCaption}</small>
        </div>

        <Bar
          data={{
            labels: monthsLabels, // Oct, Nov, ... for 12 months starting now
            datasets: stackedDatasets, // stacked by label
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: { stacked: true, grid: { display: true, lineWidth: 0.3 } },
              y: {
                stacked: true,
                beginAtZero: true,
                min: 0,
                max: 200, // overall monthly cap (stacked)
                ticks: { callback: (v) => `${v}h` },
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
          height={300}
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
                ticks: { callback: (v) => `${v}h` },
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
