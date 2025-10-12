import React, { useEffect, useMemo, useState } from "react";
import useSWR, { mutate } from "swr";
import { api } from "./lib/api";
import Charts from "./components/Charts";
import LabelManager from "./components/LabelManager";
import { format } from "date-fns";

type Entry = { id:string; day:string; label:string; minutes:number };
type Label = { id:string; name:string; color_hex: string | null };

function toHours(n:number){ return (n/60).toFixed(2); }

export default function App(){
  const [authNeeded, setAuthNeeded] = useState(false);
  const { data: labels = [] } = useSWR<Label[]>("/api/labels", api, {
    shouldRetryOnError:false,
    onError: (e)=>{ if((e as Error).message==="unauthorized") setAuthNeeded(true); }
  });

  const [label, setLabel] = useState("");
  const [minutes, setMinutes] = useState<number>(0);
  const [showLM, setShowLM] = useState(false);

  const todayISO = format(new Date(), "yyyy-MM-dd");
  const { data: entries = [] } = useSWR<Entry[]>(`/api/entries?from=${todayISO}&to=${todayISO}`, api);
  const { data: recent = [] } = useSWR<Entry[]>(`/api/entries?from=${format(new Date(Date.now()-1000*60*60*24*14), "yyyy-MM-dd")}&to=${todayISO}`, api);

  const totalToday = entries.reduce((s,e)=> s + e.minutes, 0);

  const save = async()=>{
    if(!label || minutes < 0) return;
    await api("/api/entries", { method:"POST", body: JSON.stringify({ day: todayISO, label, minutes }) });
    setMinutes(0);
    await Promise.all([
      mutate(`/api/entries?from=${todayISO}&to=${todayISO}`),
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
        <div className="title">𝓗𝓸𝓾𝓻𝓼    𝓢𝓪𝓽    𝓓𝓸𝔀𝓷</div>
      </div>

      <div className="top-grid">
        <div className="card">
          <div className="input-row">
            <div style={{flex:2}}>
              <label>Label</label>
              <input list="labels" placeholder="e.g., Reading" value={label} onChange={e=> setLabel(e.target.value)} />
              <datalist id="labels">
                {labels.map(l=> <option key={l.id} value={l.name} />)}
              </datalist>
            </div>
            <div style={{flex:1}}>
              <label>Minutes</label>
              <input type="number" min={0} value={minutes} onChange={e=> setMinutes(parseInt(e.target.value||"0"))} />
            </div>
            <div>
              <button className="button" onClick={save}>Save</button>
            </div>
            <div>
              <button className="action-btn" title="Manage Labels" onClick={()=> setShowLM(true)}>🏷️</button>
            </div>
          </div>
          <div className="total">Total today: {toHours(totalToday)} h</div>

          <div className="table">
            {recent.map(e=> (
              <div className="entry-row" key={e.id}>
                <div>{e.day}</div>
                <div>{editingId===e.id? <input value={editLabel} onChange={ev=> setEditLabel(ev.target.value)} /> : e.label}</div>
                <div>{editingId===e.id? <input type="number" min={0} value={editMinutes} onChange={ev=> setEditMinutes(parseInt(ev.target.value||"0"))} /> : `${e.minutes} min`}</div>
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

        <div className="sticky">
          <textarea placeholder="Note" value={note} onChange={e=> setNote(e.target.value)} onBlur={()=>{
            api("/api/sticky-note", { method:"PUT", body: JSON.stringify({ content: note }) }).catch(()=>{});
          }} />
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
