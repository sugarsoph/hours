import React, { useEffect, useState } from "react";
import useSWR, { mutate } from "swr";
import { api } from "./lib/api";
import Charts from "./components/Charts";
import LabelManager from "./components/LabelManager";
import { format, parseISO, addDays } from "date-fns";

type Entry = { id:string; day:string; label:string; minutes:number };
type Label = { id:string; name:string; color_hex: string | null };

function toHours(n:number){ return (n/60).toFixed(2); }

export default function App(){
  const [authNeeded, setAuthNeeded] = useState(false);
  const { data: labels = [] } = useSWR<Label[]>("/api/labels", api, {
    shouldRetryOnError:false,
    onError: (e)=>{ if((e as Error).message==="unauthorized") setAuthNeeded(true); }
  });

  // Selected day (defaults to today)
  const todayISO = format(new Date(), "yyyy-MM-dd");
  const [dayISO, setDayISO] = useState<string>(todayISO);

  const [label, setLabel] = useState("");
  const [minutes, setMinutes] = useState<number>(0);
  const [showLM, setShowLM] = useState(false);

  // Entries & totals for the selected day
  const { data: entries = [] } = useSWR<Entry[]>(
    `/api/entries?from=${dayISO}&to=${dayISO}`, api
  );

  // Recent list: last 14 days up to selected day
  const recentStartISO = format(addDays(parseISO(dayISO), -14), "yyyy-MM-dd");
  const { data: recent = [] } = useSWR<Entry[]>(
    `/api/entries?from=${recentStartISO}&to=${dayISO}`, api
  );

  const totalSelectedDay = entries.reduce((s,e)=> s + e.minutes, 0);

  const save = async()=>{
    if(!label || minutes < 0) return;
    await api("/api/entries", {
      method:"POST",
      body: JSON.stringify({ day: dayISO, label, minutes })
    });
    setMinutes(0);
    await Promise.all([
      mutate(`/api/entries?from=${dayISO}&to=${dayISO}`),
      mutate((key)=> typeof key==="string" && key.startsWith("/api/entries") ),
      mutate("/api/labels")
    ]);
  };

  const { data: noteData } = useSWR<{content:string}>("/api/sticky-note", api);
  const [note, setNote] = useState("");
  useEffect(()=>{ if(noteData) setNote(noteData.content||""); }, [noteData]);
  useEffect(()=>{
    const h = setTimeout(()=>{
      if(!authNeeded){
        api("/api/sticky-note", { method:"PUT", body: JSON.stringify({ content: note }) }).catch(()=>{});
      }
    }, 700);
    return ()=> clearTimeout(h);
  }, [note, authNeeded]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMinutes, setEditMinutes] = useState<number>(0);
  const [editLabel, setEditLabel] = useState<string>("");

  const startEdit = (e:Entry)=>{
    setEditingId(e.id);
    setEditMinutes(e.minutes);
    setEditLabel(e.label);
  };
  const doEdit = async(id:string)=>{
    await api(`/api/entries/${id}`, { method:"PATCH", body: JSON.stringify({ minutes: editMinutes, label: editLabel }) });
    setEditingId(null);
    await Promise.all([
      mutate((key)=> typeof key==="string" && key.startsWith("/api/entries")),
      mutate("/api/labels")
    ]);
  };
  const doDelete = async(id:string)=>{
    await api(`/api/entries/${id}`, { method:"DELETE" });
    await Promise.all([
      mutate((key)=> typeof key==="string" && key.startsWith("/api/entries")),
      mutate("/api/labels")
    ]);
  };

  return (
    <div className="app">
      <div className="header">
        <div className="title"> 𝓗𝓸𝓾𝓻𝓼    𝓢𝓪𝓽    𝓓𝓸𝔀𝓷 </div>
      </div>

      <div className="top-grid">
        <div className="card">
          {/* Center the block; inputs stacked on the left; big Log button on the right */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-end",
              gap: "32px",
              marginTop: "12px",
            }}
          >
            {/* left column (stacked inputs, slightly left aligned) */}
            <div style={{ display: "flex", flexDirection: "column", width: 260, textAlign: "left" }}>
              {/* Date */}
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>Date</label>
                <input
                  type="date"
                  value={dayISO}
                  onChange={(e) => setDayISO(e.target.value)}
                  style={{ width: "100%", padding: "6px 8px" }}
                />
              </div>
              {/* Label */}
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>Label</label>
                <input
                  list="labels"
                  placeholder="˚ ༘ ೀ⋆｡˚"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  style={{ width: "100%", padding: "6px 8px" }}
                />
                <datalist id="labels">
                  {labels.map((l) => <option key={l.id} value={l.name} />)}
                </datalist>
              </div>
              {/* Minutes */}
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>Minutes</label>
                <input
                  type="number"
                  min={0}
                  value={Number.isFinite(minutes) ? minutes : 0}
                  onChange={(e) => setMinutes(parseInt(e.target.value || "0") || 0)}
                  style={{ width: "100%", padding: "6px 8px" }}
                />
              </div>
            </div>

            {/* right column (big Log button + label manager) */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <button
                className="button"
                onClick={save}
                style={{
                  fontSize: "1.05rem",
                  padding: "16px 40px",   // bigger than before
                  backgroundColor: "#FFD7E2",
                  borderRadius: 12,
                  boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
                }}
              >
                Log
              </button>
              <button
                className="action-btn"
                title="Manage Labels"
                onClick={() => setShowLM(true)}
                aria-label="Manage labels"
                style={{ fontSize: 18, padding: "8px 12px", borderRadius: 10 }}
              >
                🏷️
              </button>
            </div>
          </div>

          {/* Total under everything */}
          <div className="total" style={{ marginTop: 12 }}>
            Total on {format(parseISO(dayISO), "MMM d")}: {toHours(totalSelectedDay)} h
          </div>

          <div className="table">
            {recent.map(e=> (
              <div className="entry-row" key={e.id}>
                <div>{e.day}</div>
                <div>{editingId===e.id? <input value={editLabel} onChange={ev=> setEditLabel(ev.target.value)} /> : e.label}</div>
                <div>{editingId===e.id? <input type="number" min={0} value={editMinutes} onChange={ev=> setEditMinutes(parseInt(ev.target.value||"0") || 0)} /> : `${e.minutes} min`}</div>
                <div style={{display:"flex", gap:6, justifyContent:"flex-end"}}>
                  {editingId===e.id? (
                    <>
                      <button className="action-btn" onClick={()=> doEdit(e.id)}>💾</button>
                      <button className="action-btn" onClick={()=> setEditingId(null)}>✖</button>
                    </>
                  ):(
                    <>
                      <button className="action-btn" onClick={()=> startEdit(e)}>✎</button>
                      <button className="action-btn" onClick={()=> doDelete(e.id)}>🗑</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sticky note (we'll swap this to an image next) */}
        <div className="sticky">
          <textarea
            placeholder="Note"
            value={note}
            onChange={e=> setNote(e.target.value)}
            onBlur={()=>{
              api("/api/sticky-note", { method:"PUT", body: JSON.stringify({ content: note }) }).catch(()=>{});
            }}
          />
        </div>
      </div>

      <Charts />

      <div className="footer">Let's see how you do it. ♡</div>

      <LabelManager open={showLM} onClose={()=> setShowLM(false)} />

      {authNeeded && <PasswordModal onAuthed={()=> setAuthNeeded(false)} />}
    </div>
  );
}

function PasswordModal({ onAuthed }:{ onAuthed: ()=>void }){
  const [pass, setPass] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const submit = async()=>{
    setErr(null);
    try{
      await api("/api/login", { method:"POST", body: JSON.stringify({ passcode: pass }) });
      onAuthed();
      mutate("/api/labels");
    }catch(e:any){
      setErr("Incorrect passcode.");
    }
  };
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3 style={{marginTop:0}}>Enter Passcode</h3>
        <input type="password" value={pass} onChange={e=> setPass(e.target.value)} style={{width:"100%", padding:"10px 12px", border:"1px solid #eee", borderRadius:10}}/>
        {err && <div style={{color:"crimson", marginTop:8}}>{err}</div>}
        <div style={{display:"flex", justifyContent:"flex-end", gap:8, marginTop:12}}>
          <button className="button" onClick={submit}>Unlock</button>
        </div>
      </div>
    </div>
  );
}
