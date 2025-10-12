import React, { useMemo } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from "chart.js";
import { Bar } from "react-chartjs-2";
import { addDays, format, startOfMonth, endOfMonth, eachDayOfInterval, startOfYear, endOfYear } from "date-fns";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

type Entry = { id:string; day:string; label:string; minutes:number };

type Label = { id:string; name:string; color_hex:string | null };

function hours(n:number){ return +(n/60).toFixed(2); }

export default function Charts(){
  const today = new Date();
  const sevenDaysAgo = addDays(today, -6);
  const { data: labels = [] } = useSWR<Label[]>("/api/labels", api);
  const labelColor = (name:string)=> labels.find(l=>l.name===name)?.color_hex || "#FFD7E2";

  // Daily (last 7 days)
  const { data: daily = [] } = useSWR<Entry[]>(`/api/entries?from=${format(sevenDaysAgo,"yyyy-MM-dd")}&to=${format(today,"yyyy-MM-dd")}`, api);
  const dailyMap = new Map<string, number>();
  daily.forEach(e=>{
    dailyMap.set(e.day, (dailyMap.get(e.day)||0) + e.minutes);
  });
  const dailyDays = eachDayOfInterval({ start: sevenDaysAgo, end: today });
  const dailyLabels = dailyDays.map(d=> format(d,"MMM d"));
  const dailyData = dailyDays.map(d=> hours(dailyMap.get(format(d,"yyyy-MM-dd"))||0));

  // Monthly
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const { data: monthEntries = [] } = useSWR<Entry[]>(`/api/entries?from=${format(monthStart,"yyyy-MM-dd")}&to=${format(monthEnd,"yyyy-MM-dd")}`, api);
  const monthMap = new Map<string, number>();
  monthEntries.forEach(e=>{
    monthMap.set(e.day, (monthMap.get(e.day)||0) + e.minutes);
  });
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const monthLabels = monthDays.map(d=> format(d,"d"));
  const monthData = monthDays.map(d=> hours(monthMap.get(format(d,"yyyy-MM-dd"))||0));

  // Task Breakdown (current month by label)
  const byLabel = new Map<string, number>();
  monthEntries.forEach(e=>{
    byLabel.set(e.label, (byLabel.get(e.label)||0) + e.minutes);
  });
  const tbLabels = Array.from(byLabel.keys());
  const tbData = tbLabels.map(l=> hours(byLabel.get(l)||0));
  const tbColors = tbLabels.map(l=> labelColor(l));

  // Yearly cumulative
  const yStart = startOfYear(today);
  const yEnd = endOfYear(today);
  const { data: yearEntries = [] } = useSWR<Entry[]>(`/api/entries?from=${format(yStart,"yyyy-MM-dd")}&to=${format(yEnd,"yyyy-MM-dd")}`, api);
  const months = Array.from({length:12}, (_,i)=> i);
  const ym = new Array(12).fill(0);
  yearEntries.forEach(e=>{
    const m = new Date(e.day).getMonth();
    ym[m] += e.minutes;
  });
  const yData = months.map(i=> hours(ym[i]));

  return (
    <div>
      <div className="section card">
        <h2>𝓓𝓪𝓲𝓵𝔂</h2>
        <Bar data={{ labels: dailyLabels, datasets:[{ label:"Hours", data: dailyData, backgroundColor:"#FFD7E2"}] }}
             options={{ scales:{ y:{ min:0, max:12, ticks:{ callback:(v)=>`${v}h`}}}, plugins:{ tooltip:{ callbacks:{ label:(ctx)=> `${ctx.formattedValue} h`}}}}} />
      </div>

      <div className="section card">
        <h2>𝓜𝓸𝓷𝓽𝓱𝓵𝔂</h2>
        <Bar data={{ labels: monthLabels, datasets:[{ label:"Hours", data: monthData, backgroundColor:"#FFD7E2"}] }}
             options={{ scales:{ y:{ beginAtZero:true, ticks:{ callback:(v)=>`${v}h`}}}, plugins:{ tooltip:{ callbacks:{ label:(ctx)=> `${ctx.formattedValue} h`}}}}} />
      </div>

      <div className="section card">
        <h2>𝐵𝓇𝑒𝒶𝓀𝒹𝑜𝓌𝓃  𝐵𝓎  𝒯𝒶𝓈𝓀</h2>
        <Bar data={{ labels: tbLabels, datasets:[{ label:"Hours", data: tbData, backgroundColor: tbColors }] }}
             options={{ indexAxis:"y" as const, scales:{ x:{ beginAtZero:true, ticks:{ callback:(v)=>`${v}h`}}}, plugins:{ tooltip:{ callbacks:{ label:(ctx)=> `${ctx.formattedValue} h`}}}}} />
      </div>

      <div className="section card">
        <h2>𝒪𝓋𝑒𝓇𝓋𝒾𝑒𝓌</h2>
        <Bar data={{ labels:["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
                     datasets:[{ label:"Hours", data:yData, backgroundColor:"#FFD7E2" }] }}
             options={{ scales:{ y:{ beginAtZero:true, ticks:{ callback:(v)=>`${v}h`}}}, plugins:{ tooltip:{ callbacks:{ label:(ctx)=> `${ctx.formattedValue} h`}}}}} />
      </div>
    </div>
  );
}
