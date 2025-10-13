// src/App.tsx
import React, { useState } from "react";
import useSWR, { mutate, SWRConfig } from "swr";
import { api } from "./lib/api";
import Charts from "./components/Charts";
import LabelManager from "./components/LabelManager";
import { format, parseISO, addDays } from "date-fns";

type Entry = { id:string; day:string; label:string; minutes:number };
type Label = { id:string; name:string; color_hex: string | null };

function toHours(n:number){ return (n/60).toFixed(2); }

/**
 * Root component: installs global SWR error handling so any 401 triggers the passcode modal.
 * Renders <AppInner/> where your UI lives.
 */
export default function App(){
  const [authNeeded, setAuthNeeded] = useState(false);

  return (
    <SWRConfig
      value={{
        fetcher: api,
        onError: (err) => {
          if ((err as Error).message === "unauthorized") {
            setAuthNeeded(true);
          }
        },
      }}
    >
      <AppInner authNeeded={authNeeded} setAuthNeeded={setAuthNeeded} />
    </SWRConfig>
  );
}

function AppInner({ authNeeded, setAuthNeeded }:{ authNeeded:boolean; setAuthNeeded:(v:boolean)=>void }){
  // Labels (no per-hook onError; global SWRConfig handles 401s)
  const { data: labels = [] } = useSWR<Label[]>("/api/labels");

  // Selec
