// src/components/Charts.tsx
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
  ChartEvent,
  ActiveElement,
} from "chart.js";
import { Bar, Pie } from "react-chartjs-2";
import {
  addDays,
  addMonths,
  addWeeks,
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfYear,
  endOfYear,
  startOfWeek,
  endOfWeek,
  differenceInCalendarWeeks,
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
  // DAILY — Mon→Sun, clamped to 13-month window (this month → +12)
  // Slider maps 0..totalWeeks-1, where 0 = earliest week in the window.
  // Knob starts at the current week’s index inside the window.
  // ───────────────────────────────────────────────────────────────
  // Window bounds (months already used by your monthly section)
  const windowStartMonth = startOfMonth(today);
  const windowEndMonth = endOfMonth(addMonths(today, 12));
  // Weeks that cover that window
  const firstWeekStart = startOfWeek(windowStartMonth, { weekStartsOn: 1 });
  const lastWeekEnd = endOfWeek(windowEndMonth, { weekStartsOn: 1 });
  const totalWeeks =
    differenceInCalendarWeeks(lastWeekEnd, firstWeekStart, { weekStartsOn: 1 }) + 1;

  // Current week index (0..totalWeeks-1) – initial slider position
  const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
  const initialWeekIndex = clamp(
    differenceInCalendarWeeks(currentWeekStart, firstWeekStart, { weekStartsOn: 1 }),
    0,
    Math.max(totalWeeks - 1, 0)
  );

  const [weekIndex, setWeekIndex] = useState<number>(initialWeekIndex);

  const dailyStart = addWeeks(firstWeekStart, weekIndex);
  const dailyEnd = addDays(dailyStart, 6);

  const dailyKey = `/api/entries?from=${format(dailyStart, "yyyy-MM-dd")}&to=${format(
    dailyEnd,
    "yyyy-MM-dd"
  )}`;
  const { data: daily = [] } = useSWR<Entry[]>(dailyKey, api);

  const dailyMap = new Map<string, number>();
  daily.forEach((e) => dailyMap.set(e.day, (dailyMap.get(e.day) || 0) + e.minutes));

  const dailyDays = eachDayOfInterval({ start: dailyStart, end: dailyEnd });

  // Abbrev weekdays with period + two-line label: ["Mon.", "13 Oct"]
  const weekdayAbbr = (d: Date) => `${format(d, "EEE").slice(0, 3)}.`; // Mon. Tue. Wed.
  const dailyLabels = dailyDays.map(
    (d) => [weekdayAbbr(d), format(d, "d LLL")] as [string, string]
  );
  const dailyData = dailyDays.map((d) =>
    toHours(dailyMap.get(format(d, "yyyy-MM-dd")) || 0)
  );

  // ───────────────────────────────────────────────────────────────
  // MONTHLY (13 stacked bars starting this month; stacked by label)
  // e.g., if today is Oct 2025 → bars: Oct 2025 ... Oct 2026 (13 total)
  // ───────────────────────────────────────────────────────────────
  const months = useMemo(
    () => Array.from({ length: 13 }, (_, i) => startOfMonth(addMonths(today, i))),
    [today]
  );
  const monthShorts = months.map((m) => format(m, "LLL"));
  const windowFrom = months[0];
  const windowTo = endOfMonth(addMonths(today, 12)); // inclusive through month+12

  const winKey = `/api/entries?from=${format(windowFrom, "yyyy-MM-dd")}&to=${format(
    windowTo,
    "yyyy-MM-dd"
  )}`;
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
    labelNames.forEach((l) => (acc[l] = new Array(13).fill(0))); // 13 months

    winEntries.forEach((e) => {
      const d = new Date(e.day);
      const offset =
        (d.getFullYear() - baseYear) * 12 + (d.getMonth() - baseMonth);
      if (offset >= 0 && offset < 13) acc[e.label][offset] += e.minutes; // < 13
    });

    return labelNames.map((name) => ({
      label: name,
      data: acc[name].map(toHours),
      backgroundColor: colorFor(name),
      borderWidth: 0,
      stack: "months",
      barPercentage: 0.9,
      categoryPercentage: 0.9,
      maxBarThickness: 30,
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
  const monthKey = `/api/entries?from=${format(mStart, "yyyy-MM-dd")}&to=${format(
    mEnd,
    "yyyy-MM-dd"
  )}`;
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
  const yearKey = `/api/entries?from=${format(yStart, "yyyy-MM-dd")}&to=${format(
    yEnd,
    "yyyy-MM-dd"
  )}`;
  const { data: yearEntries = [] } = useSWR<Entry[]>(yearKey, api);

  const byLabelYear = new Map<string, number>();
  yearEntries.forEach((e) =>
    byLabelYear.set(e.label, (byLabelYear.get(e.label) || 0) + e.minutes)
  );
  const overviewLabels = Array.from(byLabelYear.keys());
  const overviewData = overviewLabels.map((l) => toHours(byLabelYear.get(l) || 0));
  const overviewColors = overviewLabels.map(colorFor);

  // selections
  const [dailySelected, setDailySelected] = useState<string | null>(null);
  const [monthlySelected, setMonthlySelected] = useState<string | null>(null);
  const [tbSelected, setTbSelected] = useState<string | null>(null);

  const fmtH = (n: number) => `${n.toFixed(2)} h`;

  // common "fill the box" options
  const fillBox = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: 0 as const },
    plugins: {
      legend: { position: "bottom" as const, labels: { boxWidth: 10 } },
      tooltip: { callbacks: { label: (ctx: any) => `${ctx.formattedValue} h` } },
    },
  };

  return (
    <div>
      {/* DAILY — Mon→Sun, clamped to window */}
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
              max={Math.max(totalWeeks - 1, 0)}
              step={1}
              value={weekIndex}
              onChange={(e) =>
                setWeekIndex(
                  clamp(parseInt(e.target.value, 10), 0, Math.max(totalWeeks - 1, 0))
                )
              }
              style={{ width: 220 }}
              aria-label="Shift week within window"
              title="Move by whole weeks (left = earliest)"
            />
            <button
              onClick={() =>
                setWeekIndex(
                  clamp(
                    differenceInCalendarWeeks(
                      startOfWeek(new Date(), { weekStartsOn: 1 }),
                      firstWeekStart,
                      { weekStartsOn: 1 }
                    ),
                    0,
                    Math.max(totalWeeks - 1, 0)
                  )
                )
              }
              style={{ border: "none", background: "transparent", textDecoration: "underline", fontSize: 12, cursor: "pointer" }}
              aria-label="Jump to this week"
            >
              This week
            </button>
          </div>
        </div>

        <div style={{ position: "relative", height: 460 }}>
          <Bar
            data={{
              // Chart.js supports multi-line labels by passing arrays
              labels: dailyLabels as unknown as string[],
              datasets: [{ label: "Hours", data: dailyData, backgroundColor: "#FFD7E2" }],
            }}
            options={{
              ...fillBox,
              scales: {
                x: {
                  offset: false,
                  grid: { drawBorder: false, lineWidth: 0.3 },
                  ticks: {
                    autoSkip: false,
                    maxRotation: 0,
                    minRotation: 0,
                    callback: (_val, idx) => {
                      const pair = dailyLabels[idx as number];
                      return Array.isArray(pair) ? (pair as unknown as string[]) : pair;
                    },
                  },
                },
                y: {
                  beginAtZero: true,
                  grace: 0,
                  grid: { drawBorder: false, lineWidth: 0.3 },
                  ticks: { callback: (v) => `${v}h` },
                },
              },
              elements: { bar: { barPercentage: 0.9, categoryPercentage: 0.9 } },
              plugins: { legend: { display: false } },
              onClick: (_evt: ChartEvent, els: ActiveElement[]) => {
                if (!els.length) { setDailySelected(null); return; }
                const { index } = els[0];
                const [l1, l2] = dailyLabels[index] as unknown as [string, string];
                const val = dailyData[index] ?? 0;
                setDailySelected(`${l1} ${l2}: ${fmtH(val)}`);
              },
            }}
          />
        </div>
        {dailySelected && <div style={{ marginTop: 6, fontSize: 12 }}>Selected: {dailySelected}</div>}
      </div>

      {/* MONTHLY — 13 stacked bars */}
      <div className="section card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 className="plain-title">𝓜𝓸𝓷𝓽𝓱𝓵𝔂</h2>
          <small>{yearCaption}</small>
        </div>

        <div style={{ position: "relative", height: 460, overflow: "hidden" }}>
          <Bar
            data={{
              labels: monthShorts,
              datasets: stackedDatasets,
            }}
            options={{
              ...fillBox,
              scales: {
                x: {
                  stacked: true,
                  offset: false,
                  grid: { display: true, lineWidth: 0.3, drawBorder: false },
                  ticks: { autoSkip: false },
                },
                y: {
                  stacked: true,
                  beginAtZero: true,
                  grace: 0,
                  grid: { lineWidth: 0.3, drawBorder: false },
                  ticks: { callback: (v) => `${v}h` },
                },
              },
              elements: {
                bar: { barPercentage: 0.9, categoryPercentage: 0.9, borderWidth: 0, maxBarThickness: 30 },
              },
              plugins: {
                ...fillBox.plugins,
                tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.formattedValue} h` } },
              },
              onClick: (_evt: ChartEvent, els: ActiveElement[]) => {
                if (!els.length) { setMonthlySelected(null); return; }
                const { index, datasetIndex } = els[0];
                const monthLabel = monthShorts[index];
                const segLabel = stackedDatasets[datasetIndex]?.label ?? "";
                const val = stackedDatasets[datasetIndex]?.data?.[index] ?? 0;
                setMonthlySelected(`${monthLabel} — ${segLabel}: ${fmtH(Number(val))}`);
              },
            }}
          />
        </div>
        {monthlySelected && <div style={{ marginTop: 6, fontSize: 12 }}>Selected: {monthlySelected}</div>}
      </div>

      {/* TASK BREAKDOWN */}
      <div className="section card">
        <h2>𝐵𝓇𝑒𝒶𝓀𝒹𝓸𝓌𝓃  𝐵𝓎  𝒯𝒶𝓈𝓀</h2>
        <div style={{ position: "relative", height: 620 }}>
          <Bar
            data={{
              labels: tbLabels,
              datasets: [{ label: "Hours", data: tbData, backgroundColor: tbColors.length ? tbColors : "#FFD7E2" }],
            }}
            options={{
              ...fillBox,
              indexAxis: "y" as const,
              scales: {
                x: {
                  beginAtZero: true,
                  grace: 0,
                  grid: { lineWidth: 0.3, drawBorder: false },
                  ticks: { callback: (v) => `${v}h` },
                },
                y: { grid: { drawBorder: false, lineWidth: 0.3 } },
              },
              plugins: { ...fillBox.plugins, legend: { display: false } },
              elements: { bar: { barPercentage: 0.9, categoryPercentage: 0.9 } },
              onClick: (_evt: ChartEvent, els: ActiveElement[]) => {
                if (!els.length) { setTbSelected(null); return; }
                const { index } = els[0];
                const lbl = tbLabels[index] ?? "";
                const val = tbData[index] ?? 0;
                setTbSelected(`${lbl}: ${fmtH(val)}`);
              },
            }}
          />
        </div>
        {tbSelected && <div style={{ marginTop: 6, fontSize: 12 }}>Selected: {tbSelected}</div>}
      </div>

      {/* OVERVIEW */}
      <div className="section card">
        <h2>𝒪𝓋𝑒𝓇𝓋𝒾𝑒𝔀</h2>
        <div style={{ position: "relative", height: 620 }}>
          <Pie
            data={{
              labels: overviewLabels,
              datasets: [{ data: overviewData, backgroundColor: overviewColors.length ? overviewColors : ["#FFD7E2"], borderWidth: 0 }],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              layout: { padding: 0 },
              plugins: {
                legend: { position: "bottom" },
                tooltip: {
                  callbacks: {
                    label: (ctx) => {
                      const label = ctx.label || "";
                      const val = ctx.parsed as number;
                      return `${label}: ${val.toFixed(2)} h`;
                    },
                  },
                },
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
