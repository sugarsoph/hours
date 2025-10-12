import React, { useState } from "react";
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
type Label = { id: string; name: string; color_hex: string | null };

function hours(n: number) {
  return +(n / 60).toFixed(2);
}

export default function Charts() {
  const today = new Date();

  // Sliders (only move forward)
  const [dailyOffsetDays, setDailyOffsetDays] = useState<number>(0); // 0..365
  const [monthOffset, setMonthOffset] = useState<number>(0);         // 0..24

  const { data: labels = [] } = useSWR<Label[]>("/api/labels", api);
  const labelColor = (name: string) =>
    labels.find((l) => l.name === name)?.color_hex || "#FFD7E2";

  // DAILY (7-day window shifted by dailyOffsetDays)
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

  // MONTHLY (whole month shifted by monthOffset)
  const monthAnchor = addMonths(today, monthOffset);
  const monthStart = startOfMonth(monthAnchor);
  const monthEnd = endOfMonth(monthAnchor);

  const { data: monthEntries = [] } = useSWR<Entry[]>(
    `/api/entries?from=${format(monthStart, "yyyy-MM-dd")}&to=${format(
      monthEnd,
      "yyyy-MM-dd"
    )}`,
    api
  );

  const monthMap = new Map<string, number>();
  monthEntries.forEach((e) => {
    monthMap.set(e.day, (monthMap.get(e.day) || 0) + e.minutes);
  });

  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const monthLabels = monthDays.map((d) => format(d, "d"));
  const monthData = monthDays.map((d) =>
    hours(monthMap.get(format(d, "yyyy-MM-dd")) || 0)
  );

  // TASK BREAKDOWN (for viewed month)
  const byLabelMonth = new Map<string, number>();
  monthEntries.forEach((e) => {
    byLabelMonth.set(e.label, (byLabelMonth.get(e.label) || 0) + e.minutes);
  });
  const tbLabels = Array.from(byLabelMonth.keys());
  const tbData = tbLabels.map((l) => hours(byLabelMonth.get(l) || 0));
  const tbColors = tbLabels.map((l) => labelColor(l));

  // OVERVIEW (pie by label, year-to-date)
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
              y: { min: 0, max: 15, ticks: { callback: (v) => `${v}h` } },
            },
            plugins: {
              tooltip: { callbacks: { label: (ctx) => `${ctx.formattedValue} h` } },
            },
          }}
        />
      </div>

      {/* MONTHLY */}
      <div className="section card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 className="plain-title">
            𝓜𝓸𝓷𝓽𝓱𝓵𝔂 — {format(monthStart, "LLLL yyyy")}
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              type="range"
              min={0}
              max={24}
              value={monthOffset}
              onChange={(e) => setMonthOffset(parseInt(e.target.value, 10))}
              style={{ width: 180 }}
              aria-label="Shift month"
            />
            <button
              onClick={() => setMonthOffset(0)}
              style={{ border: "none", background: "transparent", textDecoration: "underline", fontSize: 12, cursor: "pointer" }}
              aria-label="Reset to this month"
            >
              Reset
            </button>
          </div>
        </div>

        <Bar
          data={{
            labels: monthLabels,
            datasets: [{ label: "Hours", data: monthData, backgroundColor: "#FFD7E2" }],
          }}
          options={{
            scales: {
              y: {
                beginAtZero: true,
                min: 0,
                max: 200,
                ticks: { callback: (v) => `${v}h` },
                grid: { lineWidth: 0.3 },
              },
              x: {
                grid: { display: true, lineWidth: 0.3 },
                ticks: { autoSkip: true },
              },
            },
            plugins: {
              tooltip: { callbacks: { label: (ctx) => `${ctx.formattedValue} h` } },
            },
          }}
        />
      </div>

      {/* TASK BREAKDOWN (viewed month) */}
      <div className="section card">
        <h2>𝐵𝓇𝑒𝒶𝓀𝒹𝓸𝓌𝓃  𝐵𝓎  𝒯𝒶𝓈𝓀</h2>
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
