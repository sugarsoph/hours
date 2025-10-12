import React from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import {
  Chart as ChartJS,
  ArcElement,          // ⬅️ added for Pie
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Pie } from "react-chartjs-2"; // ⬅️ added Pie
import {
  addDays,
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
  const sevenDaysAgo = addDays(today, -6);

  const { data: labels = [] } = useSWR<Label[]>("/api/labels", api);
  const labelColor = (name: string) =>
    labels.find((l) => l.name === name)?.color_hex || "#FFD7E2";

  // === Daily (last 7 days) ===
  const { data: daily = [] } = useSWR<Entry[]>(
    `/api/entries?from=${format(sevenDaysAgo, "yyyy-MM-dd")}&to=${format(
      today,
      "yyyy-MM-dd"
    )}`,
    api
  );
  const dailyMap = new Map<string, number>();
  daily.forEach((e) => {
    dailyMap.set(e.day, (dailyMap.get(e.day) || 0) + e.minutes);
  });
  const dailyDays = eachDayOfInterval({ start: sevenDaysAgo, end: today });
  const dailyLabels = dailyDays.map((d) => format(d, "MMM d"));
  const dailyData = dailyDays.map((d) =>
    hours(dailyMap.get(format(d, "yyyy-MM-dd")) || 0)
  );

  // === Monthly (this month, per day) ===
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
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

  // === Task Breakdown (current month, totals by label) ===
  const byLabelMonth = new Map<string, number>();
  monthEntries.forEach((e) => {
    byLabelMonth.set(e.label, (byLabelMonth.get(e.label) || 0) + e.minutes);
  });
  const tbLabels = Array.from(byLabelMonth.keys());
  const tbData = tbLabels.map((l) => hours(byLabelMonth.get(l) || 0));
  const tbColors = tbLabels.map((l) => labelColor(l));

  // === Yearly "Overview" (pie by label for the current year) ===
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
      {/* Daily */}
      <div className="section card">
        <h2>𝓓𝓪𝓲𝓵𝔂</h2>
        <Bar
          data={{
            labels: dailyLabels,
            datasets: [
              { label: "Hours", data: dailyData, backgroundColor: "#FFD7E2" },
            ],
          }}
          options={{
            scales: {
              y: {
                min: 0,
                max: 16, // 
                ticks: { callback: (v) => `${v}h` },
              },
            },
            plugins: {
              tooltip: {
                callbacks: { label: (ctx) => `${ctx.formattedValue} h` },
              },
            },
          }}
        />
      </div>

      {/* Monthly */}
      <div className="section card">
        <h2>𝓜𝓸𝓷𝓽𝓱𝓵𝔂</h2>
        <Bar
          data={{
            labels: monthLabels,
            datasets: [
              { label: "Hours", data: monthData, backgroundColor: "#FFD7E2" },
            ],
          }}
          options={{
            scales: {
              y: {
                beginAtZero: true,
                min: 0,
                max: 200, // ⬅️ monthly cap
                ticks: { callback: (v) => `${v}h` },
              },
            },
            plugins: {
              tooltip: {
                callbacks: { label: (ctx) => `${ctx.formattedValue} h` },
              },
            },
          }}
        />
      </div>

      {/* Task Breakdown (month, by label) */}
      <div className="section card">
        <h2>𝐵𝓇𝑒𝒶𝓀𝒹𝑜𝓌𝓃  𝐵𝓎  𝒯𝒶𝓈𝓀</h2>
        <Bar
          data={{
            labels: tbLabels,
            datasets: [
              {
                label: "Hours",
                data: tbData,
                backgroundColor: tbColors, // ⬅️ uses your label colors (or pink)
              },
            ],
          }}
          options={{
            indexAxis: "y" as const,
            scales: {
              x: {
                beginAtZero: true,
                min: 0,
                max: 200, // ⬅️ breakdown cap
                ticks: { callback: (v) => `${v}h` },
              },
            },
            plugins: {
              tooltip: {
                callbacks: { label: (ctx) => `${ctx.formattedValue} h` },
              },
            },
          }}
        />
      </div>

      {/* Overview (pie by label, year-to-date) */}
      <div className="section card">
        <h2>𝒪𝓋𝑒𝓇𝓋𝒾𝑒𝓌</h2>
        <Pie
          data={{
            labels: overviewLabels,
            datasets: [
              {
                data: overviewData,
                backgroundColor: overviewColors.length
                  ? overviewColors
                  : ["#FFD7E2"],
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
                    // show "Label: X.XX h"
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
