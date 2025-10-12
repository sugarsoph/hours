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

const toHours = (mins: number) => +(mins / 60).toFixed(2);

export default function Charts() {
  const today = new Date();

  // ── Label colors
  const { data: labels = [] } = useSWR<LabelRow[]>("/api/labels", api);
  const colorFor = (name: string) =>
    labels.find((l) => l.name === name)?.color_hex || "#FFD7E2";

  // ── DAILY (7-day window; slider forward only)
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
  const dailyData = dailyDays.map((d) => toHours(dailyMap.get(format(d, "yyyy-MM-dd")) || 0));

  // ── MONTHLY (12 stacked bars: current month → next 11, stacked by label)
  const months = useMemo(
    () => Array.from({ length: 12 }, (_, i) => startOfMonth(addMonths(today, i))),
    [today]
  );
  const monthShorts = months.map((m) => format(m, "LLL")); // Oct, Nov, ...
  const windowFrom = months[0];
  const windowTo = endOfMonth(addMonths(today, 11));

  const { data: winEntries = [] } = useSWR<Entry[]>(
    `/api/entries?from=${format(windowFrom, "yyyy-MM-dd")}&to=${format(windowTo, "yyyy-MM-dd")}`,
    api
  );

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
    labelNames.forEach((l) => (acc[l] = new Array(12).fill(0)));

    winEntries.forEach((e) => {
      const d = new Date(e.day);
      const offset = (d.getFullYear() - baseYear) * 12 + (d.getMonth() - baseMonth);
      if (offset >= 0 && offset < 12) acc[e.label][offset] += e.minutes;
    });

    // Keep bars visually modest
    return labelNames.map((name) => ({
      label: name,
      data: acc[name].map(toHours),
      backgroundColor: colorFor(name),
      borderWidth: 0,
      stack: "months",
      barPercentage: 0.65,
      categoryPercentage: 0.65,
      maxBarThickness: 22,
    }));
  }, [winEntries, labelNames, months]);

  const yearCaption = (() => {
    const firstY = months[0].getFullYear();
    const lastY = months[months.length - 1].getFullYear();
    return firstY === lastY ? String(firstY) : `${firstY} — ${lastY}`;
  })();

  // ── TASK BREAKDOWN (current month totals by label)
  const mStart = startOfMonth(today);
  const mEnd = endOfMonth(today);
  const { data: monthEntries = [] } = useSWR<Entry[]>(
    `/api/entries?from=${format(mStart, "yyyy-MM-dd")}&to=${format(mEnd, "yyyy-MM-dd")}`,
    api
  );
  const byLabelMonth = new Map<string, number>();
  monthEntries.forEach((e) => byLabelMonth.set(e.label, (byLabelMonth.get(e.label) || 0) + e.minutes));
  const tbLabels = Array.from(byLabelMonth.keys());
  const tbData = tbLabels.map((l) => toHours(byLabelMonth.get(l) || 0));
  const tbColors = tbLabels.map(colorFor);

  // ── OVERVIEW (pie, YTD totals by label)
  const yStart = startOfYear(today);
  const yEnd = endOfYear(today);
  const { data: yearEntries = [] } = useSWR<Entry[]>(
    `/api/entries?from=${format(yStart, "yyyy-MM-dd")}&to=${format(yEnd, "yyyy-MM-dd")}`,
    api
  );
  const byLabelYear = new Map<string, number>();
  yearEntries.forEach((e) => byLabelYear.set(e.label, (byLabelYear.get(e.label) || 0) + e.minutes));
  const overviewLabels = Array.from(byLabelYear.keys());
  const overviewData = overviewLabels.map((l) => toHours(byLabelYear.get(l) || 0));
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

        {/* same visual height as others */}
        <div style={{ position: "relative", height: 180 }}>
          <Bar
            data={{
              labels: dailyLabels,
              datasets: [{ label: "Hours", data: dailyData, backgroundColor: "#FFD7E2" }],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false, // obey 180px wrapper
              scales: {
                y: { min: 0, max: 16, ticks: { stepSize: 2, callback: (v) => `${v}h` } },
              },
              layout: { padding: 0 },
              plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (ctx) => `${ctx.formattedValue} h` } },
                title: { display: false },
              },
              animation: false,
              elements: { bar: { borderWidth: 0 } },
            }}
          />
        </div>
      </div>

      {/* MONTHLY — 12 stacked bars, fixed height (no runaway) */}
      <div className="section card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 className="plain-title">𝓜𝓸𝓷𝓽𝓱𝓵𝔂</h2>
          <small>{yearCaption}</small>
        </div>

        {/* hard cap height to stop infinite scroll */}
        <div style={{ position: "relative", height: 180, overflow: "hidden" }}>
          <Bar
            data={{
              labels: monthShorts,
              datasets: stackedDatasets,
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false, // obey 180px wrapper
              scales: {
                x: {
                  stacked: true,
                  grid: { display: true, lineWidth: 0.3 },
                  ticks: { autoSkip: false },
                },
                y: {
                  stacked: true,
                  beginAtZero: true,
                  min: 0,
                  max: 200,
                  ticks: { stepSize: 10, callback: (v) => `${v}h` },
                  grid: { lineWidth: 0.3 },
                },
              },
              layout: { padding: 0 },
              plugins: {
                legend: { position: "bottom", labels: { boxWidth: 10 } },
                tooltip: {
                  callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.formattedValue} h` },
                },
                title: { display: false },
              },
              animation: false,
              elements: {
                bar: { barPercentage: 0.65, categoryPercentage: 0.65, borderWidth: 0, maxBarThickness: 22 },
              },
            }}
          />
        </div>
      </div>

      {/* TASK BREAKDOWN */}
      <div className="section card">
        <h2>𝐵𝓇𝑒𝒶𝓀𝒹𝑜𝓌𝓃  𝐵𝓎  𝒯𝒶𝓈𝓀</h2>
        <div style={{ position: "relative", height: 200 }}>
          <Bar
            data={{
              labels: tbLabels,
              datasets: [{ label: "Hours", data: tbData, backgroundColor: tbColors.length ? tbColors : "#FFD7E2" }],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
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
              layout: { padding: 0 },
              plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (ctx) => `${ctx.formattedValue} h` } },
              },
              animation: false,
              elements: { bar: { borderWidth: 0 } },
            }}
          />
        </div>
      </div>

      {/* OVERVIEW (pie) */}
      <div className="section card">
        <h2>𝒪𝓋𝑒𝓇𝓋𝒾𝑒𝔀</h2>
        <div style={{ position: "relative", height: 200 }}>
          <Pie
            data={{
              labels: overviewLabels,
              datasets: [{ data: overviewData, backgroundColor: overviewColors.length ? overviewColors : ["#FFD7E2"], borderWidth: 0 }],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
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
              animation: false,
            }}
          />
        </div>
      </div>
    </div>
  );
}
